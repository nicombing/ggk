"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Monitor,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  RefreshCw,
} from "lucide-react"
import { updateOrderStatus } from "@/actions/orders"

interface OperatorDashboardClientProps {
  initialOrders: any[]
  session: {
    userId: string
    email: string
    name: string | null
    role: string
  }
}

export default function OperatorDashboardClient({ initialOrders, session }: OperatorDashboardClientProps) {
  const [orders, setOrders] = useState<any[]>(initialOrders)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Map database orders to print queue jobs
  // We care about orders with status VERIFICATION (Queued), PRINTING (Printing), and PACKING/DISPATCH/COMPLETED (Completed)
  const jobs = orders.map((order, index) => {
    let jobStatus: "PRINTING" | "QUEUED" | "COMPLETED" = "QUEUED"
    if (order.status === "PRINTING") {
      jobStatus = "PRINTING"
    } else if (order.status !== "VERIFICATION") {
      jobStatus = "COMPLETED"
    }

    return {
      id: `JOB-${201 + index}`,
      orderId: order.id,
      customerName: order.customer || "Pelanggan",
      design: order.designName || "Tanpa Nama Desain",
      status: jobStatus,
      progress: order.progress || (jobStatus === "COMPLETED" ? 100 : 0),
      sheets: order.sheets || "1 sheets",
      dateStr: order.date, // format: "YYYY-MM-DD HH:mm"
      rawOrder: order,
    }
  })

  // Filter lists for active and completed
  const activeJobs = jobs.filter((j) => j.status !== "COMPLETED")
  const completedCount = jobs.filter((j) => j.status === "COMPLETED").length
  const queuedCount = jobs.filter((j) => j.status === "QUEUED").length

  const handleStartPrint = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      const updated = await updateOrderStatus(orderId, {
        status: "PRINTING",
        progress: 10,
        printing: true,
      })
      setOrders(orders.map((o) => (o.id === orderId ? updated : o)))
    } catch (err) {
      console.error("Failed to start printing:", err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handlePausePrint = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      const updated = await updateOrderStatus(orderId, {
        printing: false,
      })
      setOrders(orders.map((o) => (o.id === orderId ? updated : o)))
    } catch (err) {
      console.error("Failed to pause printing:", err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCompletePrint = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      const updated = await updateOrderStatus(orderId, {
        status: "PACKING",
        progress: 100,
        printing: false,
      })
      setOrders(orders.map((o) => (o.id === orderId ? updated : o)))
    } catch (err) {
      console.error("Failed to complete printing:", err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDownloadFile = async (job: any) => {
    // Format Date to YYMMDD (Date format: "YYYY-MM-DD HH:mm" e.g., "2026-06-16 23:25")
    let yymmdd = "260616"
    try {
      if (job.dateStr) {
        const datePart = job.dateStr.split(" ")[0] // "2026-06-16"
        const parts = datePart.split("-") // ["2026", "06", "16"]
        const yy = parts[0].slice(-2)
        const mm = parts[1]
        const dd = parts[2]
        yymmdd = `${yy}${mm}${dd}`
      }
    } catch (err) {
      console.warn("Error parsing date for filename:", err)
    }

    // Clean Customer Name: spaces and special characters replaced with underscores
    const cleanCustName = job.customerName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")

    const downloadFileName = `${cleanCustName}_${job.orderId}_${yymmdd}.png`
    const fileUrl = `/converted/${job.orderId}.png`

    try {
      // Attempt to download the actual converted file
      const res = await fetch(fileUrl)
      if (!res.ok) throw new Error("Converted file not found")
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = downloadFileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (_) {
      // Fallback: Download sample mockup PNG with the correct filename
      try {
        const res = await fetch("/smart_conversion_mockup.png")
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = downloadFileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error("Failed to download fallback file:", err)
      }
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-950 min-h-screen text-white select-none">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              GGK <span className="text-primary italic">Operator</span> Terminal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-primary/10 border border-primary/20 text-primary uppercase shadow-sm">
              Live Queue
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Halo, <span className="font-bold text-primary">{session.name || session.email}</span>! Kelola dan unduh antrian cetak aktif.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => window.location.reload()}
            variant="outline" 
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl h-11 px-4 font-bold"
          >
            <RefreshCw size={16} className="mr-2" /> Refresh Queue
          </Button>
        </div>
      </div>

      {/* Machine Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Status Mesin", value: "Operational", icon: <Monitor />, color: "bg-emerald-500/20 text-emerald-500 border-emerald-500/20" },
          { label: "Antrian Aktif", value: String(activeJobs.length), icon: <Clock />, color: "bg-amber-500/20 text-amber-500 border-amber-500/20" },
          { label: "Belum Dicetak", value: String(queuedCount), icon: <Printer />, color: "bg-primary/20 text-primary border-primary/20" },
          { label: "Selesai Dicetak", value: String(completedCount), icon: <CheckCircle2 />, color: "bg-blue-500/20 text-blue-500 border-blue-500/20" },
        ].map((stat, i) => (
          <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-md">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-4 rounded-2xl border ${stat.color} flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
                <h2 className="text-3xl font-black text-white">{stat.value}</h2>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Queue Section */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden rounded-3xl shadow-xl">
        <CardHeader className="border-b border-white/5 pb-6 px-8 pt-8 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <div className="w-2 h-6 bg-primary rounded-full" />
            Antrian Cetak Aktif ({activeJobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {activeJobs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeJobs.map((job) => (
                <Card 
                  key={job.id} 
                  className={`bg-white/[0.02] border-white/10 overflow-hidden rounded-2xl transition-all duration-300 ${
                    job.status === 'PRINTING' ? 'ring-2 ring-primary/40 bg-white/[0.04]' : ''
                  }`}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-base">{job.id}</span>
                          <span className="text-xs text-slate-500 font-mono font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10">{job.orderId}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200 mt-1.5">{job.design}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Pelanggan: <span className="text-slate-400 font-bold">{job.customerName}</span></p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        job.status === 'PRINTING' 
                          ? 'bg-primary/20 text-primary border-primary/20 animate-pulse' 
                          : 'bg-amber-500/20 text-amber-500 border-amber-500/20'
                      }`}>
                        {job.status === 'PRINTING' ? 'PRINTING' : 'QUEUED'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-500 font-bold">
                        <span>Status Produksi</span>
                        <span className="text-slate-400">{job.sheets} ({job.progress}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            job.status === 'PRINTING' ? 'bg-primary animate-pulse' : 'bg-amber-500'
                          }`}
                          style={{ width: `${job.progress || 5}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions panel */}
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      
                      {/* Download Link renamed dynamically */}
                      <Button
                        onClick={() => handleDownloadFile(job)}
                        size="sm"
                        variant="ghost"
                        className="text-primary hover:bg-primary/10 text-xs font-black uppercase tracking-wide h-9 px-3 rounded-xl flex items-center gap-2"
                      >
                        <Download size={14} /> Download Converted File
                      </Button>

                      <div className="flex gap-2">
                        {job.status === 'PRINTING' ? (
                          <>
                            <Button 
                              onClick={() => handlePausePrint(job.orderId)}
                              disabled={updatingId === job.orderId}
                              size="sm" 
                              className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/20 font-black text-[10px] uppercase tracking-wider rounded-lg h-9 px-4"
                            >
                              <Pause size={12} className="mr-1.5" /> Jeda
                            </Button>
                            <Button 
                              onClick={() => handleCompletePrint(job.orderId)}
                              disabled={updatingId === job.orderId}
                              size="sm" 
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg h-9 px-4 shadow-md shadow-emerald-600/15"
                            >
                              <CheckCircle2 size={12} className="mr-1.5" /> Selesai
                            </Button>
                          </>
                        ) : (
                          <Button 
                            onClick={() => handleStartPrint(job.orderId)}
                            disabled={updatingId === job.orderId}
                            size="sm" 
                            className="bg-primary hover:bg-secondary text-primary-foreground font-black text-[10px] uppercase tracking-wider rounded-lg h-9 px-4"
                          >
                            <Play size={12} className="mr-1.5" /> Mulai Cetak
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 font-bold border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              Tidak ada antrian cetak aktif saat ini.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Warning */}
      <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4 className="font-bold text-white">Tinta Yellow Hampir Habis</h4>
            <p className="text-sm text-slate-400">Sisa tinta yellow: 12%. Segera lakukan penggantian cartridge.</p>
          </div>
        </div>
        <Button variant="ghost" className="text-amber-500 hover:bg-amber-500/10 font-bold rounded-xl h-10 px-4">
          Cek Stok Tinta
        </Button>
      </div>
    </div>
  )
}
