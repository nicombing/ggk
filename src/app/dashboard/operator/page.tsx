import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth"
import { getOrders } from "@/actions/orders"
import OperatorDashboardClient from "./OperatorDashboardClient"

export const metadata: Metadata = {
  title: "Operator Terminal | GGK PRINTING",
  description: "Pemantauan Produksi & Antrian Cetak",
}

export default async function OperatorDashboardPage() {
  const session = await verifySession()

  if (!session) {
    redirect("/login")
  }

  // Customers shouldn't be accessing this dashboard
  if (session.role === "CUSTOMER") {
    redirect("/dashboard/customer")
  }

  const orders = await getOrders()

  return (
    <OperatorDashboardClient
      initialOrders={orders}
      session={session}
    />
  )
}
