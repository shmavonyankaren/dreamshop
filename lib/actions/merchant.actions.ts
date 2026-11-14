"use server";
import { requestMerchantAccess, reviewMerchantAccess } from "../server/access-management";
import { marketplaceResult } from "../server/marketplace-response";

export async function applyForMerchant() { return marketplaceResult(() => requestMerchantAccess()); }
export async function reviewMerchantApplication(input: unknown) { return marketplaceResult(() => reviewMerchantAccess(input)); }
