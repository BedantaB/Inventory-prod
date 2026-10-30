import {
  HouseIcon,
  PackageIcon,
  PackagePlusIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShoppingCartIcon,
  StoreIcon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react";
import type { Messages } from "@/i18n";

export type NavItem = {
  href: string;
  label: keyof Messages["nav"];
  icon: LucideIcon;
  /** Shown in the phone's bottom bar; the rest go under "More". */
  inBottomBar: boolean;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "home", icon: HouseIcon, inBottomBar: true },
  { href: "/items", label: "items", icon: PackageIcon, inBottomBar: true },
  { href: "/stock/new", label: "addStock", icon: PackagePlusIcon, inBottomBar: true },
  { href: "/orders/new", label: "newOrder", icon: ShoppingCartIcon, inBottomBar: true },
  { href: "/orders", label: "orders", icon: ReceiptTextIcon, inBottomBar: false },
  { href: "/customers", label: "customers", icon: StoreIcon, inBottomBar: false },
  { href: "/users", label: "users", icon: UserCogIcon, inBottomBar: false, adminOnly: true },
  {
    href: "/settings",
    label: "settings",
    icon: Settings2Icon,
    inBottomBar: false,
    adminOnly: true,
  },
];

/** Which nav item a URL belongs to. "/orders/new" is New Order, other /orders pages are Orders. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/orders")
    return pathname.startsWith("/orders") && !pathname.startsWith("/orders/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function visibleItems(isAdmin: boolean) {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}
