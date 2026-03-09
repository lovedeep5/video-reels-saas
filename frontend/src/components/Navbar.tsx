"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { getPlanMeta, AppUserMeta } from "@/lib/auth";

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [meta, setMeta] = useState<AppUserMeta | null>(null);

  useEffect(() => {
    setMeta(getPlanMeta());
  }, []);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/upload", label: "New Video" },
    { href: "/dashboard/keys", label: "API Keys" },
    { href: "/billing", label: "Billing" },
  ];

  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-lg font-bold text-indigo-400">VidToReels</Link>
        <div className="hidden md:flex gap-4">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href} href={href}
              className={`text-sm ${pathname === href ? "text-white font-medium" : "text-gray-400 hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
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
        <UserButton />
      </div>
    </nav>
  );
}
