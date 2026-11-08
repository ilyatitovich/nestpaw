import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth";

const links = [
  ["/", "Dashboard"],
  ["/products", "Products"],
  ["/categories", "Categories"],
  ["/inventory", "Inventory"],
  ["/orders", "Orders"],
  ["/customers", "Customers"],
  ["/discounts", "Discounts"],
  ["/shipping", "Shipping"],
  ["/tax", "Tax"],
  ["/pages", "Pages"],
  ["/returns", "Returns"],
  ["/subscriptions", "Subscriptions"],
  ["/reviews", "Reviews"],
  ["/newsletter", "Newsletter"],
  ["/settings", "Settings"],
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <p className="admin-nav__brand">Nestpaw Admin</p>
        <ul className="admin-nav__list">
          {links.map(([to, label]) => (
            <li key={to}>
              <NavLink to={to} end={to === "/"}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="admin-muted" style={{ marginTop: "2rem" }}>
          {user?.email} · {user?.role}
        </p>
        <button type="button" className="admin-btn" onClick={() => logout()}>
          Log out
        </button>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
