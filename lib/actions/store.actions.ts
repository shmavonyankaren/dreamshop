"use server";
import { marketplaceResult } from "../server/marketplace-response";
import { createStore, submitApplication, updateStore } from "../server/store-service";
import { saveMerchantProduct, archiveMerchantProduct } from "../server/merchant-products";
export async function submitStoreApplication(input: unknown) { return marketplaceResult(() => submitApplication(input)); }
export async function setupStore(input: unknown) { return marketplaceResult(() => createStore(input)); }
export async function saveStoreSettings(input: unknown) { return marketplaceResult(() => updateStore(input)); }
export async function saveStoreProduct(input: unknown) { return marketplaceResult(() => saveMerchantProduct(input)); }
export async function changeProductStatus(input: unknown) { return marketplaceResult(() => archiveMerchantProduct(input)); }
