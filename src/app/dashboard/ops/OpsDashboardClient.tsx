"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getOrders,
  updateOrderStatus,
  clearAllSimulationData
} from "@/actions/orders"
import {
  ShieldCheck,
  Printer,
  Package,
  Truck,
  CheckCircle2,
  Lock,
  Play,
  Pause,
  AlertCircle,
  Search,
  RefreshCw,
  Plus,
  ChevronRight,
  Info,
  Terminal,
  Users,
  Image as ImageIcon,
  FileImage,
  Download,
  Eye
} from "lucide-react"

type Role = "ADMIN" | "DISPATCHER" | "PACKER" | "OPERATOR" | "CUSTOMER"

interface OpsDashboardClientProps {
  initialRole: Role
  userName: string
}

interface Order {
  id: string
  customer: string
  destination: string
  date: string
  designName: string
  dimensions: string
  sheets: string
  weight: string
  price: string
  status: "VERIFICATION" | "PRINTING" | "PACKING" | "DISPATCH" | "COMPLETED"
  items: string[]
  checkedItems: string[]
  progress: number
  driver: string
  printing?: boolean
}

const INITIAL_ORDERS: Order[] = []

export default function OpsDashboardClient({ initialRole, userName }: OpsDashboardClientProps) {
  const [currentRole, setCurrentRole] = useState<Role>(initialRole)
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)
  const [logs, setLogs] = useState<string[]>([
    `[08:28:00] Sistem initialized. Logged in as ${userName} (${initialRole})`,
    `[08:28:05] Database loaded. Syncing live database order data.`
  ])
  const [search, setSearch] = useState("")
  const [driverSelects, setDriverSelects] = useState<Record<string, string>>({})

  // Add simulated log entries
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString("id-ID", { hour12: false })
    setLogs((prev) => [`[${time}] ${message}`, ...prev])
  }

  // Load orders from database on mount, when role changes, and poll every 10 seconds
  useEffect(() => {
    async function load() {
      const dbOrders = await getOrders()
      setOrders(dbOrders)
    }
    load()

    const pollInterval = setInterval(() => {
      load()
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(pollInterval)
  }, [currentRole])

  // Active Printing Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order.status === "PRINTING" && order.printing && order.progress < 100) {
            const nextProgress = Math.min(order.progress + 15, 100)
            if (nextProgress === 100) {
              addLog(`[System Alert] Printing completed for ${order.id} (${order.designName})`)
              updateOrderStatus(order.id, { progress: nextProgress, printing: false, status: "PACKING" })
              return {
                ...order,
                progress: nextProgress,
                printing: false,
                status: "PACKING",
              }
            } else {
              updateOrderStatus(order.id, { progress: nextProgress })
              return {
                ...order,
                progress: nextProgress,
              }
            }
          }
          return order
        })
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Check Role Authorization
  const hasPrivilege = (requiredRoles: Role[]) => {
    return currentRole === "ADMIN" || requiredRoles.includes(currentRole)
  }

  // Handlers
  const handleVerify = async (orderId: string) => {
    if (!hasPrivilege(["OPERATOR"])) return
    await updateOrderStatus(orderId, { status: "PRINTING", progress: 0 })
    const updated = await getOrders()
    setOrders(updated)
    addLog(`${userName} verified payment & approved ${orderId} for production.`)
  }

  const handleStartPrint = async (orderId: string) => {
    if (!hasPrivilege(["OPERATOR"])) return
    await updateOrderStatus(orderId, { printing: true })
    const updated = await getOrders()
    setOrders(updated)
    addLog(`${userName} started printing ${orderId} on MUTOH Plotter.`)
  }

  const handlePausePrint = async (orderId: string) => {
    if (!hasPrivilege(["OPERATOR"])) return
    await updateOrderStatus(orderId, { printing: false })
    const updated = await getOrders()
    setOrders(updated)
    addLog(`${userName} paused printing ${orderId}.`)
  }

  const handleForceCompletePrint = async (orderId: string) => {
    if (!hasPrivilege(["OPERATOR"])) return
    await updateOrderStatus(orderId, { progress: 100, printing: false, status: "PACKING" })
    const updated = await getOrders()
    setOrders(updated)
    addLog(`${userName} manually completed printing & advanced ${orderId} to packing.`)
  }

  const handleToggleItem = async (orderId: string, item: string) => {
    if (!hasPrivilege(["PACKER"])) return
    let updatedCheckedItems: string[] = []
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const checked = o.checkedItems.includes(item)
            ? o.checkedItems.filter((i) => i !== item)
            : [...o.checkedItems, item]
          updatedCheckedItems = checked
          return { ...o, checkedItems: checked }
        }
        return o
      })
    )
    await updateOrderStatus(orderId, { checkedItems: updatedCheckedItems })
  }

  const handleCompletePacking = async (orderId: string) => {
    if (!hasPrivilege(["PACKER"])) return
    await updateOrderStatus(orderId, { status: "DISPATCH" })
    const updated = await getOrders()
    setOrders(updated)
    addLog(`${userName} finalized packing and sealed items for ${orderId}.`)
  }

  const handleDispatch = async (orderId: string) => {
    if (!hasPrivilege(["DISPATCHER"])) return
    const driver = driverSelects[orderId] || "GGK Courier Express"
    await updateOrderStatus(orderId, { status: "COMPLETED", driver })
    const updated = await getOrders()
    setOrders(updated)
    addLog(`${userName} assigned driver (${driver}) and dispatched ${orderId} for shipping.`)
  }

  const handleReset = async () => {
    await clearAllSimulationData()
    setOrders([])
    setLogs([
      `[Reset] Database and mock orders successfully cleared.`,
      `[Reset] Currently viewing as ${userName} (${currentRole})`
    ])
    setDriverSelects({})
    addLog("State reset completed.")
  }


  const filteredOrders = orders.filter((o) => {
    const query = search.toLowerCase()
    return (
      o.id.toLowerCase().includes(query) ||
      o.customer.toLowerCase().includes(query) ||
      o.designName.toLowerCase().includes(query)
    )
  })

  const countByStatus = (status: Order["status"]) => orders.filter((o) => o.status === status).length

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 bg-surface-gray min-h-screen text-neutral-dark select-none font-sans">
      
      {/* Simulation & Info Banner */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center p-6 bg-bg-tint border border-primary/25 rounded-3xl gap-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary/10 border border-primary/15 rounded-2xl flex items-center justify-center text-primary shrink-0 animate-pulse">
            <Info size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-secondary text-lg">GGK Operational Center</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-primary text-white uppercase shadow-sm">
                Active Perspective: {currentRole}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed font-medium">
              Semua staf melihat display alur kerja yang sama. Hak akses anda ditentukan oleh peran anda.
              Pilih preview peran di kanan untuk melihat bagaimana sistem mengunci/membuka fitur.
            </p>
          </div>
        </div>
        
        {/* Role Selectors & Reset */}
        <div className="flex gap-3 items-center flex-wrap w-full xl:w-auto">
          {initialRole === "ADMIN" && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
              <Users size={16} className="text-slate-400 ml-1" />
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">Simulate:</label>
              <select
                value={currentRole}
                onChange={(e) => {
                  const role = e.target.value as Role
                  setCurrentRole(role)
                  addLog(`Simulated role perspective switched to ${role}`)
                }}
                className="bg-slate-50 border-none outline-none text-xs font-black text-primary focus:ring-0 cursor-pointer rounded-lg p-1"
              >
                <option value="ADMIN">ADMIN (Full Access)</option>
                <option value="DISPATCHER">DISPATCHER (Logistics)</option>
                <option value="OPERATOR">OPERATOR (Print Shop)</option>
                <option value="PACKER">PACKER (Packaging)</option>
              </select>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            size="sm"
            className="border-slate-200 bg-white hover:bg-slate-50 rounded-xl h-10 px-4 font-black transition-all text-xs shadow-sm hover:border-slate-300 text-slate-600"
          >
            <RefreshCw size={14} className="mr-2" /> Reset Mock Data
          </Button>
        </div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-neutral-dark">
            GGK <span className="text-primary italic">OPS</span> BOARD
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            Sistem Pemantauan Alur Kerja Terintegrasi Giat Gerak Kreasi
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80 shadow-sm rounded-2xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari Pesanan, Pelanggan, Desain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-primary/50 text-neutral-dark transition-all placeholder:text-slate-400 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Workflow Stats Tracker */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "1. Verification Queue", count: countByStatus("VERIFICATION"), color: "border-amber-500/30 text-amber-600 bg-amber-50/80", icon: <ShieldCheck size={18} /> },
          { label: "2. Printing Terminal", count: countByStatus("PRINTING"), color: "border-blue-500/30 text-blue-600 bg-blue-50/80", icon: <Printer size={18} /> },
          { label: "3. Packing Station", count: countByStatus("PACKING"), color: "border-purple-500/30 text-purple-600 bg-purple-50/80", icon: <Package size={18} /> },
          { label: "4. Dispatch Deck", count: countByStatus("DISPATCH"), color: "border-pink-500/30 text-pink-600 bg-pink-50/80", icon: <Truck size={18} /> },
          { label: "5. Completed Ships", count: countByStatus("COMPLETED"), color: "border-emerald-500/30 text-emerald-600 bg-emerald-50/80", icon: <CheckCircle2 size={18} /> },
        ].map((col, idx) => (
          <div
            key={idx}
            className={`border rounded-2xl p-4 ${col.color} shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] flex items-center justify-between`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{col.label}</p>
              <h3 className="text-2xl font-black mt-1">{col.count}</h3>
            </div>
            <div className="opacity-90">{col.icon}</div>
          </div>
        ))}
      </div>

      {/* Kanban Pipeline Board */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start overflow-x-auto pb-4">
        
        {/* Stage 1: VERIFICATION */}
        <div className="space-y-4 min-w-[280px] bg-white/60 p-4 rounded-3xl border border-slate-200/85 shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Verification
            </span>
            <span className="text-xs font-black text-slate-400">{orders.filter(o => o.status === 'VERIFICATION').length}</span>
          </div>

          <div className="space-y-4">
            {filteredOrders.filter((o) => o.status === "VERIFICATION").length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold bg-slate-50/50">
                Queue Empty
              </div>
            ) : (
              filteredOrders
                .filter((o) => o.status === "VERIFICATION")
                .map((order) => (
                  <Card key={order.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-amber-500/40 transition-all duration-300 shadow-sm hover:shadow-md relative">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500/70" />
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <span className="font-black text-sm text-secondary">{order.id}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{order.date}</span>
                      </div>
                      <CardTitle className="text-sm font-black text-neutral-dark mt-1">{order.customer}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                      <div className="p-2.5 rounded-xl bg-bg-tint border border-primary/10 text-[11px] text-slate-600 space-y-1 font-medium shadow-inner">
                        <div className="flex justify-between">
                          <span>Design:</span>
                          <span className="text-neutral-dark font-black max-w-[140px] truncate">{order.designName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Amount:</span>
                          <span className="text-primary font-black">{order.price}</span>
                        </div>
                      </div>

                      {/* Files available to Operator */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 shadow-sm group">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-amber-100 rounded-md flex items-center justify-center text-amber-600 shrink-0">
                              <ImageIcon size={12} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-neutral-dark leading-none">Bukti Transfer</span>
                              <span className="text-[8px] text-slate-400 font-bold mt-0.5">JPEG / PNG</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="outline" size="icon" className="w-6 h-6 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 border-slate-200">
                               <Eye size={12} />
                             </Button>
                             <Button variant="outline" size="icon" className="w-6 h-6 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 border-slate-200" title="Download Bukti">
                               <Download size={12} />
                             </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 shadow-sm group">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-primary/10 rounded-md flex items-center justify-center text-primary shrink-0">
                              <FileImage size={12} />
                            </div>
                            <div className="flex flex-col max-w-[120px]">
                              <span className="text-[10px] font-black text-neutral-dark leading-none truncate" title={order.designName}>{order.designName.replace(/\.[^/.]+$/, "")}.png</span>
                              <span className="text-[8px] text-primary font-black uppercase mt-0.5 tracking-widest">Smart Converted</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="outline" size="icon" className="w-6 h-6 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 border-slate-200" title="Download Print File">
                               <Download size={12} />
                             </Button>
                          </div>
                        </div>
                      </div>

                      {/* Action Trigger */}
                      {hasPrivilege(["OPERATOR"]) ? (
                        <Button
                          onClick={() => handleVerify(order.id)}
                          className="w-full h-9 text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 uppercase tracking-tight rounded-xl shadow-md active:scale-95 transition-all"
                        >
                          Verify & Approve
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black">
                          <Lock size={12} /> Requires Operator
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </div>

        {/* Stage 2: PRINTING */}
        <div className="space-y-4 min-w-[280px] bg-white/60 p-4 rounded-3xl border border-slate-200/85 shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Printing Queue
            </span>
            <span className="text-xs font-black text-slate-400">{orders.filter(o => o.status === 'PRINTING').length}</span>
          </div>

          <div className="space-y-4">
            {filteredOrders.filter((o) => o.status === "PRINTING").length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold bg-slate-50/50">
                No active print jobs
              </div>
            ) : (
              filteredOrders
                .filter((o) => o.status === "PRINTING")
                .map((order) => (
                  <Card key={order.id} className={`bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-500/40 transition-all duration-300 shadow-sm hover:shadow-md relative ${order.printing ? 'ring-1 ring-blue-500/30 bg-blue-50/30' : ''}`}>
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-blue-500/70" />
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <span className="font-black text-sm text-secondary">{order.id}</span>
                        {order.printing && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[8px] font-black uppercase tracking-widest animate-pulse shadow-sm">
                            Printing
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-sm font-black text-neutral-dark mt-1">{order.customer}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                      <div className="p-2.5 rounded-xl bg-bg-tint border border-primary/10 text-[11px] text-slate-600 space-y-1 font-medium shadow-inner">
                        <div className="flex justify-between">
                          <span>Design:</span>
                          <span className="text-neutral-dark font-black max-w-[140px] truncate">{order.designName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dimensi:</span>
                          <span className="text-neutral-dark font-mono font-bold">{order.dimensions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sheets:</span>
                          <span className="text-neutral-dark font-mono font-bold">{order.sheets}</span>
                        </div>
                      </div>

                      {/* Printing Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                          <span>Printing Progress:</span>
                          <span className="font-mono text-primary font-black">{order.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(22,163,74,0.4)]"
                            style={{ width: `${order.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Trigger */}
                      {hasPrivilege(["OPERATOR"]) ? (
                        <div className="flex gap-2">
                          {!order.printing ? (
                            <Button
                              onClick={() => handleStartPrint(order.id)}
                              className="flex-1 h-8 text-[10px] font-black bg-primary hover:bg-secondary text-white uppercase tracking-tight rounded-lg shadow-md active:scale-95 transition-all"
                            >
                              <Play size={10} className="mr-1 inline" /> Start Print
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handlePausePrint(order.id)}
                              className="flex-1 h-8 text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-slate-950 uppercase tracking-tight rounded-lg shadow-md active:scale-95 transition-all"
                            >
                              <Pause size={10} className="mr-1 inline" /> Pause
                            </Button>
                          )}
                          <Button
                            onClick={() => handleForceCompletePrint(order.id)}
                            variant="outline"
                            className="h-8 text-[9px] font-black border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-primary rounded-lg active:scale-95 transition-all shadow-sm"
                          >
                            Skip Done
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black">
                          <Lock size={12} /> Requires Operator
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </div>

        {/* Stage 3: PACKING */}
        <div className="space-y-4 min-w-[280px] bg-white/60 p-4 rounded-3xl border border-slate-200/85 shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-black uppercase tracking-widest text-purple-600 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              Packing Station
            </span>
            <span className="text-xs font-black text-slate-400">{orders.filter(o => o.status === 'PACKING').length}</span>
          </div>

          <div className="space-y-4">
            {filteredOrders.filter((o) => o.status === "PACKING").length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold bg-slate-50/50">
                No orders to pack
              </div>
            ) : (
              filteredOrders
                .filter((o) => o.status === "PACKING")
                .map((order) => {
                  const allChecked = order.items.every((item) => order.checkedItems.includes(item))
                  return (
                    <Card key={order.id} className={`bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-purple-500/40 transition-all duration-300 shadow-sm hover:shadow-md relative ${allChecked ? 'ring-1 ring-purple-500/30' : ''}`}>
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-purple-500/70" />
                      <CardHeader className="p-4 pb-2">
                        <span className="font-black text-sm text-secondary">{order.id}</span>
                        <CardTitle className="text-sm font-black text-neutral-dark mt-1">{order.customer}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-4">
                        {/* Checklist Section */}
                        <div className="p-2.5 rounded-xl bg-bg-tint border border-primary/10 shadow-inner">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <ChevronRight size={10} className="text-purple-500" /> Item Verification
                          </p>
                          <ul className="space-y-2">
                            {order.items.map((item, idx) => {
                              const isChecked = order.checkedItems.includes(item)
                              return (
                                <li
                                  key={idx}
                                  onClick={() => handleToggleItem(order.id, item)}
                                  className={`flex items-center gap-2 text-[11px] font-bold p-1 rounded cursor-pointer transition-colors ${
                                    isChecked ? 'text-success-green line-through opacity-70' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    isChecked ? 'bg-success-green/20 border-success-green' : 'border-slate-300'
                                  }`}>
                                    {isChecked && <CheckCircle2 size={8} className="text-success-green" />}
                                  </div>
                                  <span className="truncate max-w-[180px]">{item}</span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>

                        {/* Action Trigger */}
                        {hasPrivilege(["PACKER"]) ? (
                          <Button
                            disabled={!allChecked}
                            onClick={() => handleCompletePacking(order.id)}
                            className={`w-full h-9 text-xs font-black uppercase tracking-tight rounded-xl transition-all shadow-md ${
                              allChecked
                                ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/10 active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            }`}
                          >
                            {allChecked ? "Mark as Packed" : "Verify Checklist"}
                          </Button>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black">
                            <Lock size={12} /> Requires Packer
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
            )}
          </div>
        </div>

        {/* Stage 4: DISPATCH DECK */}
        <div className="space-y-4 min-w-[280px] bg-white/60 p-4 rounded-3xl border border-slate-200/85 shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-black uppercase tracking-widest text-pink-600 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
              Dispatch Deck
            </span>
            <span className="text-xs font-black text-slate-400">{orders.filter(o => o.status === 'DISPATCH').length}</span>
          </div>

          <div className="space-y-4">
            {filteredOrders.filter((o) => o.status === "DISPATCH").length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold bg-slate-50/50">
                No packed orders
              </div>
            ) : (
              filteredOrders
                .filter((o) => o.status === "DISPATCH")
                .map((order) => (
                  <Card key={order.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-pink-500/40 transition-all duration-300 shadow-sm hover:shadow-md relative">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-pink-500/70" />
                    <CardHeader className="p-4 pb-2">
                      <span className="font-black text-sm text-secondary">{order.id}</span>
                      <CardTitle className="text-sm font-black text-neutral-dark mt-1">{order.customer}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                      <div className="p-2.5 rounded-xl bg-bg-tint border border-primary/10 text-[11px] text-slate-600 space-y-1 font-medium shadow-inner">
                        <div className="flex justify-between">
                          <span>Dest:</span>
                          <span className="text-neutral-dark font-black truncate max-w-[140px]">{order.destination}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Weight:</span>
                          <span className="text-neutral-dark font-mono font-bold">{order.weight}</span>
                        </div>
                      </div>

                      {/* Driver Assignment Dropdown */}
                      {hasPrivilege(["DISPATCHER"]) ? (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Assign Courier:</label>
                          <select
                            value={driverSelects[order.id] || "GGK Courier Express"}
                            onChange={(e) => setDriverSelects({ ...driverSelects, [order.id]: e.target.value })}
                            className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-primary/50 outline-none rounded-xl p-2 cursor-pointer shadow-sm"
                          >
                            <option value="GGK Courier Express">GGK Courier Express</option>
                            <option value="Gojek Grab Instant">Gojek / Grab Instant</option>
                            <option value="JNE Reguler">JNE Reguler</option>
                            <option value="SiCepat Kargo">SiCepat Kargo</option>
                          </select>
                        </div>
                      ) : null}

                      {/* Action Trigger */}
                      {hasPrivilege(["DISPATCHER"]) ? (
                        <Button
                          onClick={() => handleDispatch(order.id)}
                          className="w-full h-9 text-xs font-black bg-primary hover:bg-secondary text-white uppercase tracking-tight rounded-xl shadow-md active:scale-95 transition-all"
                        >
                          <Truck size={12} className="mr-1 inline animate-bounce" /> Ship & Dispatch
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black">
                          <Lock size={12} /> Requires Dispatcher
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </div>

        {/* Stage 5: COMPLETED */}
        <div className="space-y-4 min-w-[280px] bg-white/60 p-4 rounded-3xl border border-slate-200/85 shadow-sm backdrop-blur-md">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Completed Ships
            </span>
            <span className="text-xs font-black text-slate-400">{orders.filter(o => o.status === 'COMPLETED').length}</span>
          </div>

          <div className="space-y-4">
            {filteredOrders.filter((o) => o.status === "COMPLETED").length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold bg-slate-50/50">
                No orders completed today
              </div>
            ) : (
              filteredOrders
                .filter((o) => o.status === "COMPLETED")
                .map((order) => (
                  <Card key={order.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all duration-300 shadow-sm hover:shadow-md relative">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500/70" />
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <span className="font-black text-sm text-slate-400">{order.id}</span>
                        <div className="flex items-center gap-1 text-emerald-600 text-[9px] font-black uppercase tracking-widest bg-emerald-50 border border-emerald-500/25 px-2 py-0.5 rounded shadow-sm">
                          <CheckCircle2 size={12} /> Shipped
                        </div>
                      </div>
                      <CardTitle className="text-sm font-black text-neutral-dark mt-1">{order.customer}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-3">
                      <div className="p-2.5 rounded-xl bg-bg-tint border border-primary/10 text-[11px] text-slate-600 space-y-1 font-medium shadow-inner">
                        <div className="flex justify-between">
                          <span>Design:</span>
                          <span className="text-neutral-dark font-black truncate max-w-[140px]">{order.designName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Courier:</span>
                          <span className="text-secondary font-black italic">{order.driver || "GGK Courier Express"}</span>
                        </div>
                      </div>
                      <div className="text-center text-[10px] text-slate-500 font-bold italic">
                        Successfully entered final shipping queue.
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </div>

      </div>

      {/* Audit Logs Console (Deep Forest themed terminal) */}
      <Card className="bg-secondary border border-primary/20 rounded-3xl overflow-hidden shadow-xl">
        <CardHeader className="border-b border-primary/10 pb-4 pt-6 px-8 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black tracking-widest text-primary-foreground uppercase flex items-center gap-2">
            <Terminal size={16} className="text-success-green animate-pulse" />
            Live System Log Console
          </CardTitle>
          <span className="w-2.5 h-2.5 rounded-full bg-success-green animate-ping" />
        </CardHeader>
        <CardContent className="p-6 bg-slate-950/40 font-mono text-xs text-slate-200 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2 flex flex-col-reverse shadow-inner">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-2 leading-relaxed">
              <span className="text-success-green shrink-0 font-bold">&gt;</span>
              <span className={log.includes("Reset") ? "text-amber-300" : log.includes("Alert") ? "text-rose-300 animate-pulse font-bold" : ""}>{log}</span>
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  )
}
