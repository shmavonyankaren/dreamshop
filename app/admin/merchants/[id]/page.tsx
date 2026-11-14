import { UserDetail } from "@/components/admin/UserDetail";
export default async function MerchantPage({ params }: { params: Promise<{ id: string }> }) { return <UserDetail id={(await params).id} />; }
