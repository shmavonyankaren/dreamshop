"use server";
import { marketplaceResult } from "../server/marketplace-response";
import { setApplicationStatus } from "../server/access-management";
import { changeStoreOperation, moderateProduct, setProductModeration } from "../server/admin-mutations";
export async function changeAccountStatus(input: unknown) { return marketplaceResult(() => setApplicationStatus(input)); }
export async function changeStoreStatus(input: unknown) { return marketplaceResult(() => changeStoreOperation(input)); }
export async function changeAdminProductStatus(input: unknown) { return marketplaceResult(() => moderateProduct(input)); }
export async function changeProductModeration(input: unknown) { return marketplaceResult(() => setProductModeration(input)); }
