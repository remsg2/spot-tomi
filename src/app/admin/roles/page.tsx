import type { Metadata } from "next";
import { Suspense } from "react";
import { buttonGhost, input, sectionTitle } from "@/components/admin/styles";
import { UserList } from "@/components/admin/user-list";
import { ta } from "@/i18n/admin.fr";
import { requireStaff } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/data";
import { cn } from "@/lib/cn";
import { changeRoleAction, setSuspendedAction } from "../actions";
import { AdminSkeleton } from "../skeleton";

export const metadata: Metadata = { title: ta.tabs.roles };

/** Onglet Rôles (admin) : liste, changement de rôle, suspension. */
export default function RolesPage({ searchParams }: PageProps<"/admin/roles">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <RolesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RolesContent({ searchParams }: Pick<PageProps<"/admin/roles">, "searchParams">) {
  const { user } = await requireStaff("admin", "/admin/roles");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 40) : "";
  const users = await listUsers(query);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>{ta.roles.title}</h2>
        <p className="text-sm text-muted">{ta.roles.intro}</p>
      </div>
      <form role="search" action="/admin/roles" className="flex gap-2">
        <label htmlFor="roles-search" className="sr-only">
          {ta.roles.search}
        </label>
        <input
          id="roles-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={ta.roles.searchPlaceholder}
          className={cn(input, "flex-1")}
        />
        <button type="submit" className={buttonGhost}>
          {ta.roles.searchSubmit}
        </button>
      </form>
      <p className="text-xs text-muted" aria-live="polite">
        {ta.roles.count(users.length)}
      </p>
      {users.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-dash p-4 text-center text-sm text-muted">
          {ta.roles.empty}
        </p>
      ) : (
        <UserList
          users={users}
          meId={user.id}
          actions={{ changeRole: changeRoleAction, setSuspended: setSuspendedAction }}
        />
      )}
    </>
  );
}
