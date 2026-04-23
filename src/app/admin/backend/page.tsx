import { AdminDashboardPageContent } from "../admin-dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function AdminBackendPage(props: PageProps) {
  return (
    <AdminDashboardPageContent adminSection="backend" searchParams={props.searchParams} />
  );
}
