import type { InventoryItem, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function decrementInventoryForLine(
  tx: Tx,
  line: { variantId: string | null; quantity: number; sku: string },
): Promise<void> {
  if (!line.variantId) return;
  const inv = await tx.inventoryItem.findUnique({
    where: { variantId: line.variantId },
  });
  if (!inv) return;

  if (inv.policy === "deny") {
    const updated = await tx.inventoryItem.updateMany({
      where: {
        variantId: line.variantId,
        quantity: { gte: line.quantity },
      },
      data: { quantity: { decrement: line.quantity } },
    });
    if (updated.count === 0) {
      throw new Error(`Insufficient stock for ${line.sku}`);
    }
    return;
  }

  await tx.inventoryItem.update({
    where: { variantId: line.variantId },
    data: { quantity: { decrement: line.quantity } },
  });
}

export async function restockInventoryForLines(
  tx: Tx,
  lines: { variantId: string | null; quantity: number }[],
): Promise<void> {
  for (const line of lines) {
    if (!line.variantId) continue;
    await tx.inventoryItem.updateMany({
      where: { variantId: line.variantId },
      data: { quantity: { increment: line.quantity } },
    });
  }
}

/** Pure helper for unit tests — whether a deny-policy item can fulfill qty. */
export function canFulfillDenyPolicy(
  inv: Pick<InventoryItem, "quantity" | "policy"> | null,
  requested: number,
): boolean {
  if (!inv) return true;
  if (inv.policy === "continue") return true;
  return inv.quantity >= requested;
}
