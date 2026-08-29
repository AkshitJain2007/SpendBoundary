import { NextResponse } from "next/server";
import { scriptedAgent } from "@/lib/agent/mock-agent";
import { AgentGoalInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = AgentGoalInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid agent input payload", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { goal } = parseResult.data;
    const execution = await scriptedAgent.executeGoal(goal);

    return NextResponse.json({
      success: true,
      execution,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to execute agent goal" },
      { status: 500 }
    );
  }
}
