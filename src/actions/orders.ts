"use server"

import prisma from "@/lib/db"
import { revalidatePath } from "next/cache"
import path from "path"
import { promises as fs } from "fs"

export interface DbOrder {
  id: string
  status: string
  customerId: string
  customerName: string
  destination: string
  designName: string
  dimensions: string
  sheets: string
  weight: string
  price: string
  itemsList: string
  checkedItems: string
  progress: number
  driver: string
  printing: boolean
  createdAt: Date
}

// Convert DB Order representation to Frontend interface format
function mapToFrontendOrder(o: any) {
  return {
    id: o.id,
    customer: o.customerName,
    destination: o.destination,
    date: new Date(o.createdAt).toISOString().replace("T", " ").substring(0, 16),
    designName: o.designName,
    dimensions: o.dimensions,
    sheets: o.sheets,
    weight: o.weight,
    price: o.price,
    status: o.status as any,
    items: JSON.parse(o.itemsList || "[]"),
    checkedItems: JSON.parse(o.checkedItems || "[]"),
    progress: o.progress,
    driver: o.driver,
    printing: o.printing,
    validation: o.validation ? {
      id: o.validation.id,
      fileSizeMb: o.validation.fileSizeMb,
      resolutionDpi: o.validation.resolutionDpi,
      widthCm: o.validation.widthCm,
      heightCm: o.validation.heightCm,
      passedValidation: o.validation.passedValidation,
      errorLogs: o.validation.errorLogs,
    } : null
  }
}

export async function getOrders() {
  const dbOrders = await prisma.order.findMany({
    include: { validation: true },
    orderBy: { createdAt: "desc" }
  })
  return dbOrders.map(mapToFrontendOrder)
}

export async function getCustomerOrders(customerId: string) {
  const dbOrders = await prisma.order.findMany({
    where: { customerId },
    include: { validation: true },
    orderBy: { createdAt: "desc" }
  })
  return dbOrders.map(mapToFrontendOrder)
}

export async function createOrder(data: {
  customerId: string
  customerName: string
  destination: string
  designName: string
  dimensions: string
  sheets: string
  weight: string
  price: string
  items: string[]
  missingFonts?: string[]
  previewUrl?: string
}) {
  const count = await prisma.order.count()
  const orderId = `ORD-${101 + count}`

  const sheetsNum = parseFloat(data.sheets) || 1.0
  const widthCm = 57.5
  const heightCm = parseFloat((sheetsNum * 100).toFixed(1))

  const newOrder = await prisma.order.create({
    data: {
      id: orderId,
      customerId: data.customerId,
      customerName: data.customerName,
      destination: data.destination,
      designName: data.designName,
      dimensions: data.dimensions,
      sheets: data.sheets,
      weight: data.weight,
      price: data.price,
      itemsList: JSON.stringify(data.items),
      checkedItems: "[]",
      status: "VERIFICATION",
      progress: 0,
      driver: "",
      printing: false,
      validation: {
        create: {
          fileSizeMb: parseFloat((0.5 + Math.random() * 20).toFixed(2)),
          resolutionDpi: 300,
          widthCm,
          heightCm,
          passedValidation: !data.missingFonts || data.missingFonts.length === 0,
          errorLogs: data.missingFonts && data.missingFonts.length > 0 
            ? `Missing Typography: ${data.missingFonts.join(", ")}` 
            : null
        }
      }
    },
    include: {
      validation: true
    }
  })

  // Save the converted file preview on the server for operator terminal downloads
  if (data.previewUrl && data.previewUrl.startsWith("data:image/png;base64,")) {
    const base64Data = data.previewUrl.replace(/^data:image\/png;base64,/, "")
    const uploadDir = path.join(process.cwd(), "public", "converted")
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, `${orderId}.png`)
      await fs.writeFile(filePath, Buffer.from(base64Data, "base64"))
      console.log(`Saved converted file for ${orderId} to ${filePath}`)
    } catch (err) {
      console.error("Failed to save converted file:", err)
    }
  }

  revalidatePath("/dashboard/ops")
  revalidatePath("/dashboard/customer")
  return mapToFrontendOrder(newOrder)
}

export async function updateOrderStatus(
  orderId: string,
  update: {
    status?: string
    progress?: number
    driver?: string
    printing?: boolean
    checkedItems?: string[]
  }
) {
  const data: any = {}
  if (update.status !== undefined) data.status = update.status
  if (update.progress !== undefined) data.progress = update.progress
  if (update.driver !== undefined) data.driver = update.driver
  if (update.printing !== undefined) data.printing = update.printing
  if (update.checkedItems !== undefined) data.checkedItems = JSON.stringify(update.checkedItems)

  const updated = await prisma.order.update({
    where: { id: orderId },
    data,
    include: { validation: true }
  })

  revalidatePath("/dashboard/ops")
  revalidatePath("/dashboard/customer")
  return mapToFrontendOrder(updated)
}

export async function simulateIncomingOrder() {
  const id = `ORD-${Math.floor(105 + Math.random() * 895)}`
  const designs = ["Lego Minifigure Custom", "Jersey Futsal GGK", "Sticker Pack Premium", "Spanduk Giat Gerak"]
  const customers = [
    { name: "Budi Santoso", id: "u-customer", dest: "Jakarta Selatan" },
    { name: "Mega Lestari", id: "u-customer", dest: "Medan Baru" },
    { name: "Anto Wijaya", id: "u-customer", dest: "Surabaya Timur" }
  ]
  const items = [["Custom Lego Sheet x1"], ["Jersey Set x5"], ["Sticker Pack HSL x10"], ["Spanduk 3x1m x1"]]
  
  const idx = Math.floor(Math.random() * designs.length)
  const cust = customers[Math.floor(Math.random() * customers.length)]
  
  const newOrder = await prisma.order.create({
    data: {
      id,
      customerId: cust.id,
      customerName: cust.name,
      destination: cust.dest,
      designName: designs[idx],
      dimensions: "58cm x 120cm",
      sheets: "85 sheets",
      weight: "1.9kg",
      price: `Rp ${1_000_000 + Math.floor(Math.random() * 15) * 100_000}`,
      status: "VERIFICATION",
      itemsList: JSON.stringify(items[idx]),
      checkedItems: "[]",
      progress: 0,
      driver: "",
      printing: false,
      validation: {
        create: {
          fileSizeMb: parseFloat((1.0 + Math.random() * 15).toFixed(2)),
          resolutionDpi: 300,
          widthCm: 58.0,
          heightCm: 120.0,
          passedValidation: true
        }
      }
    },
    include: {
      validation: true
    }
  })

  revalidatePath("/dashboard/ops")
  revalidatePath("/dashboard/customer")
  return mapToFrontendOrder(newOrder)
}

export async function clearAllSimulationData() {
  await prisma.order.deleteMany()
  revalidatePath("/dashboard/ops")
  revalidatePath("/dashboard/customer")
}
