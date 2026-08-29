import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { pricePaise: "asc" },
    });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch catalogue" },
      { status: 500 }
    );
  }
}
