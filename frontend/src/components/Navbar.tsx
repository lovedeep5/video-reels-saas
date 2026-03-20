"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { getPlanMeta, AppUserMeta } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [meta, setMeta] = useState<AppUserMeta | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMeta(getPlanMeta());
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    ...(meta?.is_admin ? [{ href: "/dashboard/upload", label: "YouTube Clips" }] : []),
    { href: "/dashboard/faceless", label: "Create Video" },
    { href: "/dashboard/schedule", label: "Schedule" },
    { href: "/dashboard/automations", label: "Automate" },
    { href: "/dashboard/keys", label: "API Keys" },
    { href: "/billing", label: "Billing" },
    { href: "/dashboard/settings", label: "Settings" },
    ...(meta?.is_admin ? [{ href: "/dashboard/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="border-b border-[var(--border-color)] bg-[var(--bg-primary)] px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold text-indigo-400">VidToReels</Link>
          {/* Desktop nav */}
          <div className="hidden md:flex gap-4">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href} href={href}
                className={`text-sm ${pathname === href ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(user || meta) && (
            <span className="text-sm text-gray-400 hidden md:block">
              {user?.firstName || meta?.name}
              {meta?.plan && (
                <span className="ml-2 bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 rounded-full capitalize">
                  {meta.plan}
                </span>
              )}
            </span>
          )}
          <ThemeToggle />
          <UserButton />
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-5 bg-gray-400 transition-all duration-200 ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block h-0.5 w-5 bg-gray-400 transition-all duration-200 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-gray-400 transition-all duration-200 ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 mt-3 pt-3 pb-2 space-y-1">
          {(user || meta) && (
            <div className="px-2 pb-3 mb-2 border-b border-gray-800">
              <span className="text-sm text-gray-300">{user?.firstName || meta?.name}</span>
              {meta?.plan && (
                <span className="ml-2 bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 rounded-full capitalize">
                  {meta.plan}
                </span>
              )}
            </div>
          )}
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block px-2 py-2.5 rounded-lg text-sm ${
                pathname === href
                  ? "text-white bg-gray-800 font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
