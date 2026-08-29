// SpendBoundary - Server-Side Cart Total Recalculation
// Strictly computes total in integer paise from database prices.
// Never trusts a total or unit price sent from client or AI agent.

import { prisma } from "./prisma";
import { CartItem } from "./schemas";
import { EvaluatedCartItem } from "./policy-engine";

export interface RecalculatedCart {
  items: EvaluatedCartItem[];
  totalPaise: number;
  currency: string;
  itemCount: number;
  validationErrors: string[];
}

export async function recalculateCartTotal(
  cartItems: CartItem[]
): Promise<RecalculatedCart> {
  const validationErrors: string[] = [];

  if (!cartItems || cartItems.length === 0) {
    return {
      items: [],
      totalPaise: 0,
      currency: "INR",
      itemCount: 0,
      validationErrors: ["Cart is empty."],
    };
  }

  // Fetch verified product details from SQLite database
  const productIds = cartItems.map((item) => item.productId);
  const dbProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
  });

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));
  const evaluatedItems: EvaluatedCartItem[] = [];
  let totalPaise = 0;
  let itemCount = 0;

  for (const item of cartItems) {
    const dbProduct = productMap.get(item.productId);

    if (!dbProduct) {
      validationErrors.push(`Product ID "${item.productId}" not found in catalogue.`);
      continue;
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      validationErrors.push(
        `Invalid quantity (${item.quantity}) for product "${dbProduct.name}".`
      );
      continue;
    }

    const itemTotalPaise = dbProduct.pricePaise * item.quantity;
    totalPaise += itemTotalPaise;
    itemCount += item.quantity;

    evaluatedItems.push({
      productId: dbProduct.id,
      name: dbProduct.name,
      category: dbProduct.category,
      pricePaise: dbProduct.pricePaise, // strictly using verified DB price
      quantity: item.quantity,
      allowed: dbProduct.allowed,
      stock: dbProduct.stock,
    });
  }

  return {
    items: evaluatedItems,
    totalPaise,
    currency: "INR",
    itemCount,
    validationErrors,
  };
}
