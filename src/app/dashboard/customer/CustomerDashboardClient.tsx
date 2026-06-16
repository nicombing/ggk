"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Package, 
  Search, 
  UploadCloud, 
  CheckCircle2,
  FileText,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Plus,
  ChevronLeft,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  Award,
  Layers
} from "lucide-react"
import { createOrder, getCustomerOrders } from "@/actions/orders"

interface CustomerDashboardClientProps {
  session: {
    userId: string
    email: string
    name: string | null
    role: string
  }
  initialOrders: any[]
}

export default function CustomerDashboardClient({ session, initialOrders }: CustomerDashboardClientProps) {
  const [orders, setOrders] = useState<any[]>(initialOrders)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1 = Specs, 2 = Upload, 3 = Payment
  
  // Poll customer orders every 10 seconds to keep live tracking progress synced in real-time
  useEffect(() => {
    async function load() {
      const dbOrders = await getCustomerOrders(session.userId)
      setOrders(dbOrders)
    }
    const pollInterval = setInterval(() => {
      load()
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(pollInterval)
  }, [session.userId])
  
  // Step 1: Specs State
  const [designName, setDesignName] = useState("")
  const [sheetsCount, setSheetsCount] = useState<number | "">("")
  const [dimensions, setDimensions] = useState("")

  // Step 2: Upload Files State
  const [designFiles, setDesignFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setDesignFiles([...designFiles, ...Array.from(e.dataTransfer.files)])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setDesignFiles([...designFiles, ...Array.from(e.target.files)])
    }
  }

  // Step 3: Payment State
  const [paymentProofFile, setPaymentProofFile] = useState<string>("")

  // Smart Conversion State
  const [conversionState, setConversionState] = useState<"idle" | "processing" | "completed" | "failed">("idle")
  const [conversionStage, setConversionStage] = useState<string>("")
  const [conversionPreview, setConversionPreview] = useState<string>("")
  const [preFlightDetails, setPreFlightDetails] = useState<any>(null)
  const [conversionError, setConversionError] = useState<string>("")

  // Font Upload State
  const [fontUploading, setFontUploading] = useState(false)
  const [fontUploadError, setFontUploadError] = useState("")
  const [fontUploadSuccess, setFontUploadSuccess] = useState("")
  const fontFileInputRef = useRef<HTMLInputElement>(null)
  
  // Calculate price dynamically: Rp 35,000/meter for Elite Premium DTF, Rp 25,000/meter for Standard Grade
  const pricePerMeter = dimensions === "Elite Premium DTF" 
    ? 35000 
    : dimensions === "Standard Grade" 
      ? 25000 
      : 0
  const calculatedPrice = (typeof sheetsCount === "number" ? sheetsCount : 0) * pricePerMeter
  const formattedPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(calculatedPrice)

  const activeOrders = orders.filter((o) => o.status !== "COMPLETED")
  const completedOrders = orders.filter((o) => o.status === "COMPLETED")

  // Simulator helper: adds a mock design file (.cdr and .pdf formats)
  const handleAddMockFile = () => {
    const mockFiles = [
      "LOGO_AYAM_LENGKUAS_VECTOR.cdr",
      "SPANDUK_GIAT_GERAK_HIGHRES.cdr",
      "KAOS_MERDEKA_BACKPRINT.pdf",
      "STICKER_GGK_PRINT_ROLL.cdr"
    ]
    const randomFile = mockFiles[Math.floor(Math.random() * mockFiles.length)]
    if (!designFiles.some(f => f.name === randomFile)) {
      const mockFile = new File(["GGK vector binary mock data"], randomFile, {
        type: randomFile.endsWith(".pdf") ? "application/pdf" : "application/cdr"
      })
      setDesignFiles([...designFiles, mockFile])
    }
  }

  // Trigger background Smart Conversion process
  const startSmartConversion = async (files: File[]) => {
    if (files.length === 0) return
    
    const targetFile = files[0]
    setConversionState("processing")
    setConversionStage("File Received")
    setConversionError("")
    
    try {
      // Small visual delay to represent stage 1
      await new Promise((resolve) => setTimeout(resolve, 800))
      setConversionStage("Format Check & Processing")
      
      // Make a real multipart/form-data request to the /api/convert endpoint!
      const formData = new FormData()
      formData.append("file", targetFile)
      
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData
      })
      
      const data = await res.json()
      
      if (!res.ok || data.error) {
        throw new Error(data.message || "Pre-flight conversion failed")
      }
      
      setConversionStage("Pre-Flight Validation")
      await new Promise((resolve) => setTimeout(resolve, 700))
      
      setConversionPreview(data.previewUrl)
      setPreFlightDetails(data.preFlight)
      setConversionState("completed")
      setConversionStage("Done")
    } catch (err: any) {
      console.error("Smart Conversion error:", err)
      setConversionError(err.message || "Smart Conversion failed. Check server logs.")
      setConversionState("failed")
    }
  }

  const handleFontUpload = async (file: File) => {
    setFontUploading(true)
    setFontUploadError("")
    setFontUploadSuccess("")
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const res = await fetch("/api/upload-font", {
        method: "POST",
        body: formData
      })
      
      const data = await res.json()
      
      if (!res.ok || data.error) {
        throw new Error(data.message || "Failed to upload font")
      }
      
      setFontUploadSuccess(`Font "${file.name}" uploaded successfully! Re-verifying design...`)
      
      // Auto re-run smart conversion to check with the newly uploaded font!
      if (designFiles.length > 0) {
        await startSmartConversion(designFiles)
      }
    } catch (err: any) {
      console.error(err)
      setFontUploadError(err.message || "Failed to upload font")
    } finally {
      setFontUploading(false)
    }
  }

  const handleFontDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFontUpload(e.dataTransfer.files[0])
    }
  }

  const handleFontSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFontUpload(e.target.files[0])
    }
  }

  // Simulator helper: deletes a design file
  const handleRemoveFile = (fileName: string) => {
    setDesignFiles(designFiles.filter((f) => f.name !== fileName))
  }

  // Simulator helper: uploads a mock transfer slip
  const handleAddMockReceipt = () => {
    setPaymentProofFile(`GGK_TRANSFER_SLIP_${Math.floor(1000 + Math.random() * 9000)}.png`)
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!designName || designFiles.length === 0 || !paymentProofFile) return

    setLoading(true)
    try {
      const newOrder = await createOrder({
        customerId: session.userId,
        customerName: session.name || session.email,
        destination: "Jakarta Selatan", 
        designName,
        dimensions,
        sheets: `${sheetsCount} sheets`,
        weight: `${((typeof sheetsCount === 'number' ? sheetsCount : 0) * 0.02).toFixed(1)}kg`,
        price: formattedPrice,
        items: [`Kaos ${designName.split(' ')[0]} x2`, `DTF Sheet ${designName.split(' ')[0]} x1`],
        missingFonts: preFlightDetails?.missingFonts,
        previewUrl: conversionPreview
      })
      
      setOrders([newOrder, ...orders])
      
      // Reset wizard to Step 1 and clear inputs
      setDesignName("")
      setSheetsCount("")
      setDimensions("")
      setDesignFiles([])
      setPaymentProofFile("")
      setCurrentStep(1)
    } catch (err) {
      console.error("Failed to place order:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-surface-gray min-h-screen text-neutral-dark font-sans select-none">
      
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-neutral-dark">Portal Pelanggan</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-primary/10 border border-primary/20 text-primary uppercase shadow-sm">
              Live DB Session
            </span>
          </div>
          <p className="text-slate-500 italic mt-1 font-medium">
            Halo, <span className="font-bold text-secondary">{session.name || session.email}</span>! Pantau pesanan Anda dan buat pesanan cetak baru.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              window.location.reload()
            }}
            variant="outline" 
            className="font-bold border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl h-11 px-4 shadow-sm"
          >
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Active Order or 3-Step Wizard */}
        <div className="lg:col-span-2 space-y-8">
          
          {activeOrders.length > 0 ? (
            activeOrders.map((order) => (
              <Card key={order.id} className="border-slate-200/80 shadow-xl rounded-3xl bg-white relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-[4px] bg-primary animate-pulse" />
                <CardHeader className="pt-8 px-8">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm ${
                      order.status === 'VERIFICATION' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      order.status === 'PRINTING' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                      order.status === 'PACKING' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                      'bg-pink-500/10 text-pink-600 border-pink-500/20'
                    }`}>
                      {order.status === 'VERIFICATION' && "Menunggu Verifikasi"}
                      {order.status === 'PRINTING' && `Mencetak (${order.progress}%)`}
                      {order.status === 'PACKING' && "Sedang Dikemas"}
                      {order.status === 'DISPATCH' && "Siap Dikirim / Kurir"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono font-bold">{order.id}</span>
                  </div>
                  <CardTitle className="text-2xl font-black text-neutral-dark mt-2">Pesanan Dalam Proses</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">
                    {order.status === 'VERIFICATION' && "Pembayaran & file Anda sedang diverifikasi oleh dispatcher."}
                    {order.status === 'PRINTING' && "Plotter MUTOH kami sedang mencetak desain Anda secara presisi."}
                    {order.status === 'PACKING' && "Staf packing kami sedang memeriksa checklist item Anda."}
                    {order.status === 'DISPATCH' && "Pesanan Anda siap diserahkan ke kurir pengiriman."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-8 pb-8">
                  
                  {/* Order Details box */}
                  <div className="bg-bg-tint/70 border border-primary/10 p-5 rounded-2xl flex justify-between items-center shadow-inner">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
                        <Package />
                      </div>
                      <div>
                        <p className="font-black text-sm text-neutral-dark">{order.designName}</p>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                          {order.sheets} | Tipe: {order.dimensions}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-primary text-xl">{order.price}</p>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                      <span>Status Produksi</span>
                      <span className="font-mono text-primary font-black">
                        {order.status === 'VERIFICATION' && 'Stage 1: Verification'}
                        {order.status === 'PRINTING' && `Stage 2: Printing ${order.progress}%`}
                        {order.status === 'PACKING' && 'Stage 3: Packing'}
                        {order.status === 'DISPATCH' && 'Stage 4: Dispatch Deck'}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(22,163,74,0.4)]"
                        style={{ 
                          width: 
                            order.status === 'VERIFICATION' ? '15%' :
                            order.status === 'PRINTING' ? `${15 + (order.progress * 0.45)}%` :
                            order.status === 'PACKING' ? '70%' :
                            order.status === 'DISPATCH' ? '90%' : '100%'
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                    <Button className="w-full sm:flex-1 h-12 font-black bg-primary text-white hover:bg-secondary rounded-xl shadow-md shadow-primary/15 transition-all">
                      <Search className="mr-2" size={18} /> Lacak Real-Time
                    </Button>
                    <Button variant="outline" className="w-full sm:flex-1 h-12 font-bold border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl shadow-sm transition-all">
                      Butuh Bantuan?
                    </Button>
                  </div>

                </CardContent>
              </Card>
            ))
          ) : (
            /* 3-STEP ORDER WIZARD CARD */
            <Card className="border-slate-200/80 shadow-xl rounded-3xl bg-white overflow-hidden transition-all duration-300">
              <div className="h-[4px] bg-primary w-full" />
              
              {/* Stepper visual header */}
              <CardHeader className="pt-8 px-8 border-b border-slate-100">
                <div className="flex justify-between items-center max-w-lg mx-auto mb-2">
                  {[
                    { num: 1, label: "Spesifikasi" },
                    { num: 2, label: "Upload Desain" },
                    { num: 3, label: "Pembayaran" }
                  ].map((s) => (
                    <div key={s.num} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs transition-all ${
                        currentStep === s.num 
                          ? "bg-primary text-white ring-4 ring-primary/20 scale-105" 
                          : currentStep > s.num 
                            ? "bg-emerald-500 text-white" 
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}>
                        {currentStep > s.num ? <CheckCircle2 size={12} /> : s.num}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider hidden sm:inline ${
                        currentStep === s.num ? "text-secondary" : "text-slate-400"
                      }`}>
                        {s.label}
                      </span>
                      {s.num < 3 && <div className={`w-8 h-0.5 hidden md:block ${currentStep > s.num ? "bg-emerald-500" : "bg-slate-200"}`} />}
                    </div>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="px-8 py-8">
                {/* STEP 1: SPECIFICATION INPUT */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-secondary">Step 1: Spesifikasi Cetak</h3>
                        <p className="text-xs text-slate-500 font-medium">Input nama desain, dimensi, dan jumlah meter cetak.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                          Nama Desain / Logo
                        </label>
                        <input
                          type="text"
                          required
                          value={designName}
                          onChange={(e) => setDesignName(e.target.value)}
                          placeholder="Contoh: Jersey Futsal GGK V3"
                          className="w-full h-12 bg-slate-55 border border-slate-200 focus:bg-white focus:border-primary/50 text-neutral-dark rounded-xl px-4 text-sm focus:outline-none transition-all shadow-inner font-bold"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                          Jumlah Sheets (Meter)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          required
                          value={sheetsCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSheetsCount(val === "" ? "" : parseInt(val) || "");
                          }}
                          placeholder="Contoh: 50"
                          className="w-full h-12 bg-slate-55 border border-slate-200 focus:bg-white focus:border-primary/50 text-neutral-dark rounded-xl px-4 text-sm focus:outline-none transition-all shadow-inner font-bold font-mono"
                        />
                      </div>
                    </div>

                    {/* Printing Type Selection Section */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">
                        Printing Type Selection
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Elite Premium DTF Option */}
                        <div
                          onClick={() => setDimensions("Elite Premium DTF")}
                          className={`relative flex gap-4 p-5 rounded-2xl cursor-pointer text-left transition-all shadow-sm ${
                            dimensions === "Elite Premium DTF"
                              ? "border-2 border-primary bg-primary/5 ring-2 ring-primary/10"
                              : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                            dimensions === "Elite Premium DTF"
                              ? "bg-emerald-100/70 border-primary/20 text-primary"
                              : "bg-slate-50 border-slate-100 text-slate-400"
                          }`}>
                            <Award size={22} className={dimensions === "Elite Premium DTF" ? "animate-pulse" : ""} />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 text-base leading-snug">Elite Premium DTF</h4>
                            <p className="text-xs text-slate-500 font-bold mt-1 leading-relaxed">
                              High-opacity white layer with anti-migration technology.
                            </p>
                          </div>
                          
                          <span className="absolute top-4 right-4 px-2.5 py-0.5 rounded-lg text-[9px] font-black tracking-wider bg-primary border border-primary-foreground/20 text-white uppercase shadow-sm flex items-center gap-1">
                            PREMIUM
                          </span>
                        </div>

                        {/* Standard Grade Option */}
                        <div
                          onClick={() => setDimensions("Standard Grade")}
                          className={`relative flex gap-4 p-5 rounded-2xl cursor-pointer text-left transition-all shadow-sm ${
                            dimensions === "Standard Grade"
                              ? "border-2 border-primary bg-primary/5 ring-2 ring-primary/10"
                              : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                            dimensions === "Standard Grade"
                              ? "bg-emerald-100/70 border-primary/20 text-primary"
                              : "bg-slate-50 border-slate-100 text-slate-400"
                          }`}>
                            <Layers size={20} />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 text-base leading-snug">Standard Grade</h4>
                            <p className="text-xs text-slate-500 font-bold mt-1 leading-relaxed">
                              Cost-efficient solution for light-colored promotional items.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Estimasi Harga & Checkout Button Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 bg-bg-tint border border-primary/15 rounded-2xl shadow-inner mt-4">
                      <div className="md:col-span-1 flex flex-col justify-center text-left">
                        <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Estimasi Harga</span>
                        <span className="text-2xl font-black text-primary mt-1">{calculatedPrice === 0 ? "0" : formattedPrice}</span>
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          disabled={!designName || !sheetsCount || !dimensions}
                          onClick={() => {
                            if (designName && sheetsCount && dimensions) setCurrentStep(2)
                          }}
                          className="w-full h-12 bg-primary hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm uppercase tracking-tight shadow-md transition-all active:scale-[0.98] flex items-center justify-center"
                        >
                          Lanjut ke Upload File <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: FILE UPLOAD */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <UploadCloud size={20} />
                        </div>
                        <div>
                          <h3 className="font-black text-lg text-secondary">Step 2: Unggah File Desain</h3>
                          <p className="text-xs text-slate-500 font-medium">Unggah file artwork DTF Anda untuk produksi plotter.</p>
                        </div>
                      </div>
                      <Button
                        onClick={handleAddMockFile}
                        size="sm"
                        className="bg-primary hover:bg-secondary text-white font-black text-[10px] tracking-widest uppercase rounded-lg shadow-sm"
                      >
                        Simulasikan Upload
                      </Button>
                    </div>

                    {/* File Dropzone */}
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      className="border-dashed border-2 border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-primary/40 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 shadow-inner flex flex-col items-center justify-center"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        accept=".cdr,.pdf,.ai,.tiff" 
                        onChange={handleFileSelect} 
                      />
                      <div className="p-3 bg-white border border-slate-100 rounded-full shadow-sm text-slate-400 mb-3 group-hover:text-primary">
                        <UploadCloud size={24} className="text-primary animate-bounce" />
                      </div>
                      <p className="font-bold text-sm text-neutral-dark">Pilih File Artwork / Drop File di sini</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase mt-2 tracking-wider">Format: AI, PDF, CDR, TIFF (Maks. 100MB)</p>
                    </div>

                    {/* File Lists */}
                    {designFiles.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">File Terpilih ({designFiles.length})</p>
                        <div className="space-y-2">
                          {designFiles.map((file, i) => (
                            <div key={i} className="p-3 bg-bg-tint/70 border border-primary/10 rounded-xl flex justify-between items-center shadow-inner">
                              <div className="flex items-center gap-3">
                                <ImageIcon size={16} className="text-primary shrink-0" />
                                <span className="text-xs font-bold text-neutral-dark font-mono truncate max-w-[280px]">{file.name}</span>
                              </div>
                              <Button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveFile(file.name)
                                }}
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-rose-500 rounded-lg"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 border border-dashed border-slate-100 rounded-xl text-slate-400 text-xs font-bold bg-slate-50/20 italic">
                        Belum ada file terunggah. Silakan klik dropzone atau tombol 'Simulasikan Upload'.
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex gap-4">
                      <Button
                        onClick={() => setCurrentStep(1)}
                        variant="outline"
                        className="h-12 border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-5 flex items-center shadow-sm font-bold"
                      >
                        <ChevronLeft size={16} className="mr-1" /> Kembali
                      </Button>
                      <Button
                        disabled={designFiles.length === 0}
                        onClick={() => {
                          setCurrentStep(3)
                          startSmartConversion(designFiles)
                        }}
                        className="flex-1 h-12 bg-primary hover:bg-secondary text-white font-black rounded-xl text-sm uppercase tracking-tight shadow-md transition-all active:scale-[0.98]"
                      >
                        Lanjut ke Pembayaran <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: PAYMENT & CONFIRMATION */}
                {currentStep === 3 && (
                  <form onSubmit={handlePlaceOrder} className="space-y-6 animate-fadeIn">
                    
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <ShoppingBag size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-secondary">Step 3: Pembayaran & Konfirmasi</h3>
                        <p className="text-xs text-slate-500 font-medium">Unggah bukti transfer Anda untuk verifikasi instan.</p>
                      </div>
                    </div>

                    {/* Bill summary and Account transfer info side-by-side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-bg-tint border border-primary/10 shadow-inner">
                      <div className="space-y-2 border-b md:border-b-0 md:border-r border-primary/10 pb-4 md:pb-0 md:pr-6">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detail Pesanan</p>
                        <div className="text-xs space-y-1.5 font-bold text-slate-600">
                          <div className="flex justify-between">
                            <span>Desain:</span>
                            <span className="text-neutral-dark max-w-[140px] truncate">{designName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tipe Cetak:</span>
                            <span className="text-neutral-dark">{dimensions}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Jumlah:</span>
                            <span className="text-neutral-dark">{sheetsCount} sheets (Meter)</span>
                          </div>
                          <div className="flex justify-between border-t border-primary/10 pt-2 text-primary font-black text-sm">
                            <span>Total Tagihan:</span>
                            <span>{formattedPrice}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 md:pl-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rekening Pembayaran</p>
                        <div className="p-3 bg-white border border-primary/10 rounded-xl space-y-1.5 shadow-sm text-xs font-bold text-slate-600">
                          <p className="text-secondary font-black">BANK BCA (GGK PRINTING)</p>
                          <p className="font-mono text-sm tracking-wider text-primary font-black">123-456-7890</p>
                          <p className="text-[9px] uppercase tracking-wider text-slate-400">a/n CV Giat Gerak Kreasi</p>
                        </div>
                      </div>
                    </div>

                    {/* SMART CONVERSION STATUS WORKFLOW CONTAINER */}
                    <Card className="border border-slate-200/80 shadow-md rounded-2xl overflow-hidden bg-white">
                      <div className="p-4 bg-secondary border-b border-primary/10 flex items-center justify-between">
                        <span className="text-xs font-black tracking-widest text-primary-foreground uppercase flex items-center gap-1.5">
                          <Sparkles size={14} className="text-primary animate-pulse" />
                          System Smart Conversion
                        </span>
                        {conversionState === "processing" && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        )}
                      </div>
                      
                      <CardContent className="p-6 space-y-6">
                        {/* 1. Stage Progress Tracker */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[
                            { num: 1, label: "File Received", activeStage: "File Received", desc: "Source file mounted" },
                            { num: 2, label: "Format & Convert", activeStage: "Format Check & Processing", desc: "Running Inkscape CLI" },
                            { num: 3, label: "Pre-Flight OK", activeStage: "Pre-Flight Validation", desc: "DPI & Transparency check" }
                          ].map((s) => {
                            const isDone = conversionState === "completed" || 
                              (s.num === 1 && (conversionStage === "Format Check & Processing" || conversionStage === "Pre-Flight Validation" || conversionStage === "Done")) ||
                              (s.num === 2 && (conversionStage === "Pre-Flight Validation" || conversionStage === "Done"))
                            
                            const isCurrent = conversionStage === s.activeStage && conversionState !== "completed" && conversionState !== "failed"
                            
                            return (
                              <div key={s.num} className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                                <div className="flex justify-center">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                    isDone 
                                      ? "bg-emerald-500 text-white" 
                                      : isCurrent 
                                        ? "bg-amber-500 text-slate-950 animate-pulse" 
                                        : "bg-slate-200 text-slate-400"
                                  }`}>
                                    {isDone ? <CheckCircle2 size={10} /> : s.num}
                                  </div>
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-700">{s.label}</p>
                                <p className="text-[8px] text-slate-400 font-bold leading-tight">{s.desc}</p>
                              </div>
                            )
                          })}
                        </div>

                        {/* 2. Conversion Processing / Loading State */}
                        {conversionState === "processing" && (
                          <div className="flex flex-col items-center justify-center py-6 border border-dashed border-amber-500/20 bg-amber-50/20 rounded-2xl space-y-3">
                            <RefreshCw size={24} className="text-amber-500 animate-spin" />
                            <div className="text-center">
                              <p className="text-xs font-black text-amber-700">Converting .cdr vector to transparent .png...</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-1">Stage: {conversionStage}</p>
                            </div>
                          </div>
                        )}

                        {/* 3. Conversion Failed Error Alert */}
                        {conversionState === "failed" && (
                          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl space-y-3">
                            <div className="flex gap-2">
                              <AlertCircle size={16} className="shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-black">Pre-Flight Conversion Error</p>
                                <p className="text-[10px] text-rose-500 mt-1">{conversionError}</p>
                              </div>
                            </div>
                            <Button 
                              type="button"
                              onClick={() => startSmartConversion(designFiles)}
                              className="w-full h-8 text-[10px] uppercase font-black bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
                            >
                              Retry Conversion
                            </Button>
                          </div>
                        )}

                        {/* 4. Converted Preview & Pre-Flight Feedback (Checkered Transparency Layout) */}
                        {conversionState === "completed" && (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                              
                              {/* Checkered Background dynamic preview container */}
                              <div className="md:col-span-2 flex justify-center">
                                <div 
                                  className="w-32 h-32 border border-slate-200 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center relative p-2"
                                  style={{
                                    backgroundImage: `
                                      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                                      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                                      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                                      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
                                    `,
                                    backgroundSize: '16px 16px',
                                    backgroundPosition: '0 0, 0 8px, 8px -8px, 8px 0px',
                                    backgroundColor: '#ffffff'
                                  }}
                                >
                                  {/* Render transparent PNG inside checkered layout */}
                                  <img 
                                    src={conversionPreview} 
                                    alt="Smart Preview" 
                                    className="max-w-full max-h-full object-contain drop-shadow-md transition-all duration-500 hover:scale-105"
                                  />
                                  <span className="absolute bottom-1 right-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm">
                                    PNG PREVIEW
                                  </span>
                                </div>
                              </div>

                              {/* Pre-Flight Validation Feedback Badges */}
                              <div className="md:col-span-3 space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pre-Flight Metrics</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: "DPI Export", val: `${preFlightDetails?.dpi} DPI`, success: true },
                                    { label: "Alpha Layer", val: preFlightDetails?.background, success: true },
                                    { label: "Resolution", val: preFlightDetails?.resolution.split(" ")[0], success: true },
                                    { label: "Original Size", val: preFlightDetails?.fileSize, success: true },
                                    { label: "Conversion Time", val: preFlightDetails?.conversionTime, success: true },
                                    { label: "Verification", val: "PASS", success: true },
                                    { label: "Accuracy", val: preFlightDetails?.accuracyScore, success: preFlightDetails?.accuracyScore === "100%" },
                                    { label: "Font Status", val: preFlightDetails?.accuracyStatus, success: preFlightDetails?.accuracyScore === "100%" }
                                  ].map((b, i) => (
                                    <div key={i} className={`p-2.5 border rounded-xl ${b.success ? 'bg-slate-50 border-slate-200/60' : 'bg-amber-50 border-amber-200/60'} ${b.label === 'Font Status' ? 'col-span-2' : ''}`}>
                                      <span className="text-[8px] text-slate-400 font-bold block leading-none">{b.label}</span>
                                      <span className={`text-xs font-black mt-1 flex items-center gap-1 ${b.success ? 'text-secondary' : 'text-amber-600'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.success ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        <span className={b.label === 'Font Status' ? '' : 'truncate'}>{b.val}</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                
                                {preFlightDetails?.missingFonts && 
                                  (Array.isArray(preFlightDetails.missingFonts) 
                                    ? preFlightDetails.missingFonts.length > 0 
                                    : preFlightDetails.missingFonts !== "None") && (
                                  <div className="space-y-3 mt-4 p-4 bg-amber-50/70 border border-amber-500/25 rounded-2xl shadow-sm text-left">
                                    <div className="flex gap-2">
                                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-black text-amber-800 leading-snug">
                                          the font you are using seems to be premium or piad font. please upload your font to get 100% accurate.
                                        </p>
                                        <p className="text-[10px] text-amber-600 font-bold mt-1">
                                          Missing Fonts: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">{Array.isArray(preFlightDetails.missingFonts) ? preFlightDetails.missingFonts.join(", ") : preFlightDetails.missingFonts}</span>
                                        </p>
                                      </div>
                                    </div>

                                    {/* Font Dropzone */}
                                    <div 
                                      onClick={() => fontFileInputRef.current?.click()}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={handleFontDrop}
                                      className="border-dashed border-2 border-amber-300 bg-white hover:bg-amber-50/40 hover:border-amber-500 rounded-xl p-4 text-center cursor-pointer transition-all duration-300 shadow-inner flex flex-col items-center justify-center relative overflow-hidden"
                                    >
                                      <input 
                                        type="file" 
                                        ref={fontFileInputRef} 
                                        className="hidden" 
                                        accept=".ttf,.otf,.woff,.woff2" 
                                        onChange={handleFontSelect} 
                                      />
                                      {fontUploading ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <RefreshCw size={20} className="text-amber-600 animate-spin" />
                                          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Installing font...</span>
                                        </div>
                                      ) : fontUploadSuccess ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <CheckCircle2 size={20} className="text-emerald-500" />
                                          <span className="text-[10px] font-black text-emerald-700">{fontUploadSuccess}</span>
                                        </div>
                                      ) : (
                                        <>
                                          <UploadCloud size={20} className="text-amber-500 mb-1.5" />
                                          <p className="font-black text-xs text-amber-800">Drop font file here or browse</p>
                                          <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mt-0.5">Supports: .ttf, .otf, .woff, .woff2</p>
                                        </>
                                      )}
                                    </div>

                                    {fontUploadError && (
                                      <p className="text-[10px] font-bold text-rose-500 text-center">{fontUploadError}</p>
                                    )}
                                  </div>
                                )}

                                <div className="p-2 bg-emerald-50 border border-emerald-500/20 text-emerald-700 text-[10px] font-black rounded-lg flex items-center gap-1.5 shadow-sm mt-2">
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                  Ready to Print: Alpha Channel transparent validation PASS
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                      </CardContent>
                    </Card>

                    {/* Payment Proof dropzone */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                          Unggah Bukti Pembayaran
                        </label>
                        <Button
                          type="button"
                          onClick={handleAddMockReceipt}
                          size="sm"
                          className="bg-primary hover:bg-secondary text-white font-black text-[9px] tracking-widest uppercase rounded-lg shadow-sm h-7 px-2"
                        >
                          Simulasikan Struk
                        </Button>
                      </div>
                      
                      <div 
                        onClick={handleAddMockReceipt}
                        className={`border-dashed border-2 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 shadow-inner flex flex-col items-center justify-center ${
                          paymentProofFile 
                            ? "bg-emerald-50/50 border-emerald-500/30" 
                            : "bg-slate-50/50 border-slate-200 hover:bg-slate-50 hover:border-primary/40"
                        }`}
                      >
                        <div className={`p-2 rounded-full border shadow-sm mb-2 ${
                          paymentProofFile ? "bg-white border-emerald-100 text-emerald-500" : "bg-white border-slate-100 text-slate-400"
                        }`}>
                          <UploadCloud size={20} className={paymentProofFile ? "" : "animate-bounce"} />
                        </div>
                        {paymentProofFile ? (
                          <div className="space-y-1">
                            <p className="font-black text-xs text-emerald-600">Bukti Transfer Berhasil Ditambahkan!</p>
                            <p className="text-[10px] text-slate-500 font-mono font-bold">{paymentProofFile}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-xs text-neutral-dark">Klik untuk Pilih Struk Transfer</p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1">Mendukung: JPG, PNG, PDF (Maks. 5MB)</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        variant="outline"
                        className="h-12 border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-5 flex items-center shadow-sm font-bold"
                      >
                        <ChevronLeft size={16} className="mr-1" /> Kembali
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading || !paymentProofFile || designFiles.length === 0}
                        className="flex-1 h-12 bg-primary hover:bg-secondary disabled:opacity-50 text-white font-black rounded-xl text-sm uppercase tracking-tight shadow-md transition-all active:scale-[0.98]"
                      >
                        {loading ? "Memproses..." : "Konfirmasi & Kirim Pesanan"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Column: Dynamic Info / Sidebar */}
        <div className="space-y-8">
          
          <Card className="bg-white border border-slate-200/80 p-8 rounded-3xl shadow-xl space-y-6">
            <h4 className="font-black text-lg text-secondary flex items-center gap-2">
              <ShieldCheck className="text-primary" size={20} />
              Jaminan Layanan GGK
            </h4>
            
            <div className="space-y-4 text-xs font-bold text-slate-600 leading-relaxed">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-primary/10 border border-primary/15 text-primary flex items-center justify-center shrink-0">1</div>
                <p>Presisi cetak mutakhir dengan detail warna sRGB/CMYK super akurat.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-primary/10 border border-primary/15 text-primary flex items-center justify-center shrink-0">2</div>
                <p>Bahan elastis kualitas tinggi, tahan pecah, dan garansi cuci cuci mesin 50X+.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-primary/10 border border-primary/15 text-primary flex items-center justify-center shrink-0">3</div>
                <p>Verifikasi instant & notifikasi real-time di portal Anda.</p>
              </div>
            </div>
          </Card>

        </div>

      </div>

      {/* History Grid */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-black text-neutral-dark tracking-tight">Pesanan Terakhir (Selesai)</h3>
        
        {completedOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedOrders.map((order) => (
              <div key={order.id} className="p-4 bg-white border border-slate-200/80 rounded-2xl flex justify-between items-center hover:bg-bg-tint/40 hover:border-primary/20 transition-all duration-300 shadow-sm hover:shadow">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-emerald-50 border border-success-green/20 text-success-green rounded-xl shadow-sm">
                     <CheckCircle2 size={16} />
                  </div>
                  <div>
                     <p className="font-black text-sm text-neutral-dark">{order.id}</p>
                     <p className="text-[10px] text-slate-400 font-bold">{order.date}</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="font-black text-sm text-neutral-dark">{order.price}</p>
                   <p className="text-[9px] text-success-green font-black uppercase tracking-widest bg-emerald-50 border border-success-green/20 px-2 py-0.5 rounded shadow-sm">SELESAI</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold bg-slate-50/50">
            Belum ada riwayat pesanan selesai.
          </div>
        )}
      </div>

    </div>
  )
}
