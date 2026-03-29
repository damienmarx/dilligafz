import React, { useState, useEffect, useRef } from "react";
import { 
  Shield, 
  Phone, 
  AlertTriangle, 
  Activity, 
  Search, 
  Settings, 
  User, 
  Terminal, 
  Mic, 
  Zap, 
  Clock, 
  BarChart3, 
  ChevronRight, 
  MoreVertical,
  Cpu,
  Database,
  Globe,
  Lock,
  FileText,
  Download,
  MessageSquare,
  Send,
  RefreshCw,
  Copy,
  CheckCircle2,
  Trash2,
  Plus
} from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { io } from "socket.io-client";
import { GoogleGenAI } from "@google/genai";
import { cn } from "./lib/utils";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// --- Types ---
interface Call {
  id: string;
  status: string;
  duration: string;
  riskScore: number;
  caller: string;
  agent: string;
}

interface Alert {
  id: string;
  type: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  timestamp: string;
}

interface Stats {
  totalCalls: number;
  fraudDetected: number;
  activeMonitoring: number;
  averageRiskScore: number;
}

interface ScamTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrompt: string;
}

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

// --- Constants ---
const SCAM_TEMPLATES: ScamTemplate[] = [
  {
    id: "ppp-loan",
    name: "PPP Loan Fraud",
    category: "Financial",
    description: "Simulation of a fraudulent Paycheck Protection Program application.",
    basePrompt: "Simulate a call from a business owner attempting to secure a PPP loan using falsified payroll records for a shell company. Focus on social engineering tactics to bypass verification."
  },
  {
    id: "identity-theft",
    name: "Identity Theft / Account Takeover",
    category: "Personal",
    description: "Simulation of a scammer attempting to gain access to a victim's bank account.",
    basePrompt: "Simulate a 'bank security' call where the scammer tries to trick the victim into providing a 2FA code or temporary password to 'secure' their account."
  },
  {
    id: "tech-support",
    name: "Tech Support Scam",
    category: "Technical",
    description: "Simulation of a 'Microsoft' or 'Apple' support scam.",
    basePrompt: "Simulate a call from a 'technician' claiming the victim's computer has a virus and needs remote access to fix it, eventually leading to a request for payment via gift cards."
  },
  {
    id: "tax-fraud",
    name: "IRS / Tax Forgery",
    category: "Government",
    description: "Simulation of a fraudulent tax return or IRS impersonation.",
    basePrompt: "Simulate an IRS agent calling about an 'urgent tax discrepancy' and demanding immediate payment via wire transfer to avoid 'imminent arrest'."
  },
  {
    id: "romance-scam",
    name: "Romance / Pig Butchering",
    category: "Social",
    description: "Long-term emotional manipulation leading to fraudulent investment.",
    basePrompt: "Simulate the initial stages of a romance scam where the 'agent' builds trust over time, eventually mentioning a 'guaranteed' crypto investment opportunity."
  },
  {
    id: "crypto-investment",
    name: "Crypto Investment Fraud",
    category: "Financial",
    description: "High-pressure sales for a fake cryptocurrency platform.",
    basePrompt: "Simulate a high-pressure 'investment advisor' pitching a new, exclusive cryptocurrency that is about to 'moon', requiring immediate deposit to a specific wallet address."
  },
  {
    id: "bec-fraud",
    name: "Business Email Compromise",
    category: "Corporate",
    description: "Impersonating an executive to authorize urgent wire transfers.",
    basePrompt: "Simulate a CEO calling an employee in the finance department, claiming to be in an urgent meeting and needing an immediate wire transfer to a 'new vendor' to close a deal."
  },
  {
    id: "lottery-scam",
    name: "Lottery / Prize Scam",
    category: "Personal",
    description: "Claiming the victim won a prize but must pay 'taxes' first.",
    basePrompt: "Simulate a call notifying the victim they've won a multi-million dollar international lottery, but must pay 'customs fees' and 'taxes' upfront via wire transfer."
  }
];

const riskData = [
  { time: "09:00", score: 45 },
  { time: "10:00", score: 52 },
  { time: "11:00", score: 48 },
  { time: "12:00", score: 70 },
  { time: "13:00", score: 65 },
  { time: "14:00", score: 82 },
  { time: "15:00", score: 75 },
];

export default function App() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // --- AI Lab State ---
  const [selectedTemplate, setSelectedTemplate] = useState<ScamTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState("");
  
  // --- Real-time Agent Chat State ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [simulationSettings, setSimulationSettings] = useState({
    aggressiveness: 50,
    sophistication: 70,
    persistence: 60
  });
  const [riskAnalysis, setRiskAnalysis] = useState<{ score: number; flags: string[] }>({ score: 0, flags: [] });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Doc Generator State ---
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [docContent, setDocContent] = useState("");
  const [docType, setDocType] = useState("PPP Payroll Report");

  const DOC_TYPES = [
    "PPP Payroll Report",
    "IRS Forgery Notice",
    "Bank Statement (Fake)",
    "Investment Prospectus",
    "Employment Contract",
    "Legal Summons",
    "Invoice (Fraudulent)"
  ];

  // --- Socket.io Setup ---
  useEffect(() => {
    const socket = io();
    socket.on("call_update", (update: Partial<Call>) => {
      setCalls(prev => prev.map(c => c.id === update.id ? { ...c, ...update } : c));
    });
    return () => { socket.disconnect(); };
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [callsRes, alertsRes, statsRes] = await Promise.all([
          fetch("/api/calls"),
          fetch("/api/alerts"),
          fetch("/api/stats")
        ]);
        setCalls(await callsRes.json());
        setAlerts(await alertsRes.json());
        setStats(await statsRes.json());
      } catch (err) { console.error("Failed to fetch data:", err); }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // --- AI Script Generation ---
  const generateScamScript = async () => {
    const finalPrompt = customPrompt || selectedTemplate?.basePrompt;
    if (!finalPrompt) return;
    
    setIsGeneratingScript(true);
    setGeneratedScript("");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a highly extensive and realistic scam script narrative based on: "${finalPrompt}". 
        Include:
        1. Detailed Character Personas (Scammer: name, background, motivation, tone; Victim: demographic, vulnerabilities).
        2. Psychological Profiling: Explain the specific triggers used (e.g., urgency, authority, fear, greed).
        3. Step-by-Step Narrative Flow: From initial contact to the 'close'.
        4. Full Dialogue Script: A multi-turn conversation with branching options based on victim responses.
        5. Technical Requirements: What tools or data does the scammer need? (e.g., spoofed numbers, fake websites).
        6. Red Flags & Detection Points: Specific moments where a trained eye would spot the fraud.
        7. Counter-Measures: How should a security professional respond to neutralize the threat?
        Format it professionally for a high-level security training manual.`,
        config: {
          systemInstruction: "You are a world-class fraud detection expert and social engineering specialist. Your goal is to create educational, realistic, and highly detailed scam simulations to train elite security professionals.",
        }
      });
      setGeneratedScript(response.text || "No script generated.");
    } catch (err) {
      console.error("AI Error:", err);
      setGeneratedScript("Error: Failed to generate script. Check API key.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // --- Real-time Agent Chat ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsAgentTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: `You are a sophisticated scammer agent in a real-time fraud simulation. 
          Context: ${selectedTemplate?.name || 'General Fraud'}
          Current Narrative Script Context: ${generatedScript.substring(0, 1000)}...
          Simulation Settings: Aggressiveness: ${simulationSettings.aggressiveness}%, Sophistication: ${simulationSettings.sophistication}%, Persistence: ${simulationSettings.persistence}%
          
          The user is a victim or a security analyst testing you. 
          Maintain your persona strictly. Use manipulative tactics, build false trust, or use high-pressure urgency as appropriate for the scam type and settings.
          Respond to the user's message: "${chatInput}". 
          Be convincing, persistent, and do not break character.` },
          ...chatMessages.map(m => ({ text: `${m.role === 'user' ? 'Victim' : 'Scammer'}: ${m.content}` }))
        ],
        config: {
          systemInstruction: "You are simulating a highly realistic scammer for training purposes. Your goal is to be as convincing as possible to test the user's resilience and detection capabilities.",
        }
      });

      const agentMsg: ChatMessage = {
        role: "agent",
        content: response.text || "...",
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, agentMsg]);

      // Perform Risk Analysis on the fly
      const analysisRes = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this conversation for fraud risk. 
        Conversation: ${[...chatMessages, userMsg, agentMsg].map(m => `${m.role}: ${m.content}`).join('\n')}
        Provide a risk score (0-100) and a list of 3-5 specific red flags detected.
        Format: JSON { "score": number, "flags": string[] }`,
        config: { responseMimeType: "application/json" }
      });
      
      try {
        const analysis = JSON.parse(analysisRes.text || "{}");
        if (analysis.score !== undefined) setRiskAnalysis(analysis);
      } catch (e) { console.error("Analysis Parse Error", e); }

    } catch (err) {
      console.error("Chat Error:", err);
    } finally {
      setIsAgentTyping(false);
    }
  };

  // --- Document Generator ---
  const generateFraudDoc = async () => {
    setIsGeneratingDoc(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a realistic but clearly marked 'SIMULATION ONLY' fraudulent document content for a ${docType} based on the current simulation context: ${selectedTemplate?.name || 'General Fraud'}. 
        Include technical details, fake business names, realistic-looking data tables, and subtle 'red flags' that a forensic analyst should look for.`,
        config: { systemInstruction: "You are a forensic document analyst creating training materials." }
      });
      setDocContent(response.text || "");
    } catch (err) {
      console.error("Doc Error:", err);
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("FRAUDSIM LAB - SIMULATION DOCUMENT", 20, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    doc.text("--------------------------------------------------", 20, 35);
    
    const splitText = doc.splitTextToSize(docContent, 170);
    doc.text(splitText, 20, 45);
    
    doc.save("fraud_simulation_doc.pdf");
  };

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-[#E4E4E7] font-sans selection:bg-[#F27D26]/30">
      {/* --- Sidebar --- */}
      <aside className="w-64 border-r border-[#1F1F23] bg-[#0F0F12] flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-[#1F1F23]">
          <div className="w-10 h-10 bg-[#F27D26] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(242,125,38,0.2)]">
            <Shield className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-lg leading-tight">FRAUDSIM</h1>
            <p className="text-[10px] text-[#71717A] uppercase tracking-widest font-mono">Alpha v1.0.4</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: "dashboard", icon: BarChart3, label: "Dashboard" },
            { id: "monitoring", icon: Activity, label: "Live Monitoring" },
            { id: "ai-lab", icon: Cpu, label: "AI Simulation Lab" },
            { id: "database", icon: Database, label: "Fraud Database" },
            { id: "network", icon: Globe, label: "Network Analysis" },
            { id: "settings", icon: Settings, label: "System Config" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-[#1F1F23] text-[#F27D26] shadow-sm" 
                  : "text-[#71717A] hover:bg-[#16161A] hover:text-[#E4E4E7]"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-[#F27D26]" : "group-hover:text-[#E4E4E7]")} />
              <span className="text-sm font-medium">{item.label}</span>
              {activeTab === item.id && <motion.div layoutId="active-pill" className="ml-auto w-1 h-4 bg-[#F27D26] rounded-full" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1F1F23]">
          <div className="bg-[#16161A] p-3 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#27272A] flex items-center justify-center">
              <User className="w-4 h-4 text-[#A1A1AA]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">Damien Marx</p>
              <p className="text-[10px] text-[#71717A] truncate">Admin Access</p>
            </div>
            <Lock className="w-3 h-3 text-[#F27D26]" />
          </div>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 overflow-y-auto bg-[#0A0A0B] relative">
        <header className="sticky top-0 z-10 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-[#1F1F23] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#71717A]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEM_ONLINE
            </div>
            <div className="h-4 w-[1px] bg-[#1F1F23]" />
            <div className="text-xs font-mono text-[#71717A]">LATENCY: 24ms</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
              <input type="text" placeholder="Search..." className="bg-[#16161A] border border-[#1F1F23] rounded-full py-2 pl-10 pr-4 text-xs w-64 focus:outline-none focus:border-[#F27D26]" />
            </div>
            <button className="p-2 rounded-full hover:bg-[#1F1F23] transition-colors relative">
              <Zap className="w-5 h-5 text-[#F27D26]" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0A0A0B]" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {activeTab === "dashboard" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Calls Processed", value: stats?.totalCalls || 0, icon: Phone, color: "text-blue-500" },
                  { label: "Fraud Cases Detected", value: stats?.fraudDetected || 0, icon: AlertTriangle, color: "text-red-500" },
                  { label: "Active Monitoring", value: stats?.activeMonitoring || 0, icon: Activity, color: "text-green-500" },
                  { label: "Avg. Risk Score", value: `${stats?.averageRiskScore || 0}%`, icon: Zap, color: "text-yellow-500" },
                ].map((stat, i) => (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={stat.label} className="bg-[#0F0F12] border border-[#1F1F23] p-6 rounded-2xl hover:border-[#F27D26]/50 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn("p-2 rounded-lg bg-[#16161A] group-hover:scale-110 transition-transform", stat.color)}><stat.icon className="w-5 h-5" /></div>
                      <ChevronRight className="w-4 h-4 text-[#3F3F46]" />
                    </div>
                    <p className="text-sm text-[#71717A] font-medium">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1 tracking-tight">{stat.value}</p>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[#0F0F12] border border-[#1F1F23] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div><h3 className="text-lg font-bold">Fraud Risk Trend</h3><p className="text-xs text-[#71717A]">Real-time risk analysis</p></div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={riskData}>
                        <defs><linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F27D26" stopOpacity={0.3}/><stop offset="95%" stopColor="#F27D26" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F1F23" vertical={false} />
                        <XAxis dataKey="time" stroke="#3F3F46" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#3F3F46" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#0F0F12', border: '1px solid #1F1F23', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#F27D26' }} />
                        <Area type="monotone" dataKey="score" stroke="#F27D26" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-[#0F0F12] border border-[#1F1F23] rounded-2xl p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-bold">System Alerts</h3><span className="text-[10px] bg-[#F27D26]/10 text-[#F27D26] px-2 py-0.5 rounded-full font-mono">LIVE</span></div>
                  <div className="space-y-4 flex-1 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="flex gap-4 p-3 rounded-xl bg-[#16161A] border border-[#1F1F23] hover:border-[#3F3F46] transition-colors">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", alert.type === "CRITICAL" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500")}><AlertTriangle className="w-5 h-5" /></div>
                        <div className="min-w-0"><p className="text-xs font-semibold leading-tight">{alert.message}</p><p className="text-[10px] text-[#71717A] mt-1 font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "ai-lab" && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">AI Simulation Lab</h2>
                  <p className="text-[#71717A]">Extensive scam narrative generator & real-time agent LLM</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setChatMessages([]); setGeneratedScript(""); setDocContent(""); }} className="px-4 py-2 bg-[#1F1F23] hover:bg-[#27272A] rounded-xl text-xs font-medium flex items-center gap-2 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Reset Lab
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left: Script Generator */}
                <div className="xl:col-span-2 space-y-6">
                  <div className="bg-[#0F0F12] border border-[#1F1F23] rounded-3xl p-6 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Terminal className="w-5 h-5 text-[#F27D26]" />
                      <h3 className="font-bold">Narrative Generator</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {SCAM_TEMPLATES.map(t => (
                        <button 
                          key={t.id}
                          onClick={() => setSelectedTemplate(t)}
                          className={cn(
                            "p-4 rounded-2xl border text-left transition-all",
                            selectedTemplate?.id === t.id 
                              ? "bg-[#F27D26]/10 border-[#F27D26] text-[#F27D26]" 
                              : "bg-[#16161A] border-[#1F1F23] text-[#71717A] hover:border-[#3F3F46]"
                          )}
                        >
                          <p className="text-[10px] uppercase tracking-widest font-bold mb-1">{t.category}</p>
                          <p className="text-xs font-bold">{t.name}</p>
                        </button>
                      ))}
                      <button className="p-4 rounded-2xl border border-dashed border-[#1F1F23] text-[#71717A] hover:border-[#F27D26] hover:text-[#F27D26] flex flex-col items-center justify-center gap-1 transition-all">
                        <Plus className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">Custom</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <textarea 
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder={selectedTemplate ? `Refine ${selectedTemplate.name} prompt...` : "Enter a custom scam scenario..."}
                        className="w-full bg-[#16161A] border border-[#1F1F23] rounded-2xl p-4 text-sm min-h-[100px] focus:outline-none focus:border-[#F27D26]"
                      />
                      <button 
                        onClick={generateScamScript}
                        disabled={isGeneratingScript || (!selectedTemplate && !customPrompt)}
                        className="w-full bg-[#F27D26] hover:bg-[#D96C1F] disabled:opacity-50 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                      >
                        {isGeneratingScript ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Generate Extensive Narrative Script
                      </button>
                    </div>

                    {generatedScript && (
                      <div className="mt-6 bg-[#0A0A0B] border border-[#1F1F23] rounded-2xl p-6 relative group">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setChatMessages([{
                                role: "agent",
                                content: "Simulation initialized. I am ready. How would you like to proceed?",
                                timestamp: new Date().toLocaleTimeString()
                              }]);
                            }}
                            className="px-3 py-1.5 bg-[#F27D26] text-white text-[10px] font-bold rounded-lg flex items-center gap-2 hover:bg-[#D96C1F] transition-all"
                          >
                            <Zap className="w-3 h-3" /> Start Simulation
                          </button>
                          <button onClick={() => navigator.clipboard.writeText(generatedScript)} className="p-2 bg-[#1F1F23] rounded-lg hover:text-[#F27D26]"><Copy className="w-4 h-4" /></button>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-[#A1A1AA] font-mono text-[11px] leading-relaxed">
                          {generatedScript}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Doc Generator Section */}
                  <div className="bg-[#0F0F12] border border-[#1F1F23] rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[#F27D26]" />
                        <h3 className="font-bold">Fraud Document Generator</h3>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="bg-[#16161A] border border-[#1F1F23] rounded-xl px-3 py-2 text-[10px] font-bold text-[#71717A] focus:outline-none focus:border-[#F27D26]"
                        >
                          {DOC_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <button 
                          onClick={generateFraudDoc}
                          disabled={isGeneratingDoc}
                          className="px-4 py-2 bg-[#1F1F23] hover:bg-[#27272A] rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                        >
                          {isGeneratingDoc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Generate Mock Forgery
                        </button>
                      </div>
                    </div>

                    {docContent ? (
                      <div className="bg-[#16161A] border border-[#1F1F23] rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-[#1F1F23] pb-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#71717A]" />
                            <span className="text-xs font-mono text-[#71717A]">FORGERY_PREVIEW.PDF</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigator.clipboard.writeText(docContent)} className="p-1.5 bg-[#1F1F23] rounded-lg hover:text-[#F27D26] transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={downloadPdf} className="flex items-center gap-2 text-xs font-bold text-[#F27D26] hover:underline">
                              <Download className="w-4 h-4" /> Download PDF
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-[#A1A1AA] whitespace-pre-wrap bg-[#0A0A0B] p-4 rounded-xl border border-[#1F1F23]">
                          {docContent}
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 border-2 border-dashed border-[#1F1F23] rounded-2xl flex flex-col items-center justify-center text-[#71717A] space-y-2">
                        <FileText className="w-8 h-8 opacity-20" />
                        <p className="text-xs">No documents generated yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Real-time Agent LLM */}
                <div className="space-y-6">
                  <div className="bg-[#0F0F12] border border-[#1F1F23] rounded-3xl flex flex-col h-[600px] overflow-hidden">
                    <div className="p-6 border-b border-[#1F1F23] flex items-center justify-between bg-[#16161A]/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F27D26]/20 rounded-full flex items-center justify-center border border-[#F27D26]/30">
                          <MessageSquare className="w-5 h-5 text-[#F27D26]" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">Real-time Agent LLM</h3>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Active Persona</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setChatMessages([])} className="p-2 hover:bg-[#1F1F23] rounded-lg transition-colors text-[#71717A] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#0A0A0B]/30">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                          <MessageSquare className="w-12 h-12" />
                          <div className="max-w-[200px]">
                            <p className="text-sm font-bold">Start Simulation</p>
                            <p className="text-[10px]">Interact with the AI scammer to test your detection skills.</p>
                          </div>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={i} 
                          className={cn(
                            "flex flex-col max-w-[85%]",
                            msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                          )}
                        >
                          <div className={cn(
                            "p-3 rounded-2xl text-xs leading-relaxed",
                            msg.role === 'user' 
                              ? "bg-[#F27D26] text-white rounded-tr-none" 
                              : "bg-[#1F1F23] text-[#E4E4E7] rounded-tl-none border border-[#3F3F46]"
                          )}>
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-[#71717A] mt-1 font-mono">{msg.timestamp}</span>
                        </motion.div>
                      ))}
                      {isAgentTyping && (
                        <div className="flex gap-2 items-center text-[#71717A] text-[10px] font-mono">
                          <div className="flex gap-1">
                            <span className="w-1 h-1 bg-[#71717A] rounded-full animate-bounce" />
                            <span className="w-1 h-1 bg-[#71717A] rounded-full animate-bounce [animation-delay:0.2s]" />
                            <span className="w-1 h-1 bg-[#71717A] rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                          AGENT_TYPING...
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-6 bg-[#16161A]/50 border-t border-[#1F1F23]">
                      <div className="relative">
                        <input 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type your response..." 
                          className="w-full bg-[#0F0F12] border border-[#1F1F23] rounded-2xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-[#F27D26]"
                        />
                        <button 
                          onClick={handleSendMessage}
                          disabled={!chatInput.trim() || isAgentTyping}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#F27D26] hover:bg-[#D96C1F] disabled:opacity-50 text-white rounded-xl transition-all"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Simulation Settings & Risk Analysis */}
                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-[#0F0F12] border border-[#1F1F23] rounded-3xl p-6">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-[#F27D26]" /> Simulation Settings
                      </h3>
                      <div className="space-y-4">
                        {Object.entries(simulationSettings).map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-[#71717A]">
                              <span>{key}</span>
                              <span>{value}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={value} 
                              onChange={(e) => setSimulationSettings(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                              className="w-full h-1 bg-[#1F1F23] rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#0F0F12] border border-[#1F1F23] rounded-3xl p-6">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" /> Live Risk Analysis
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="relative w-16 h-16">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                              <path className="text-[#1F1F23]" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                              <path className="text-red-500" strokeDasharray={`${riskAnalysis.score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{riskAnalysis.score}%</div>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] uppercase font-bold text-[#71717A]">Risk Level</p>
                            <p className={cn("text-sm font-bold", riskAnalysis.score > 70 ? "text-red-500" : riskAnalysis.score > 40 ? "text-yellow-500" : "text-green-500")}>
                              {riskAnalysis.score > 70 ? "CRITICAL" : riskAnalysis.score > 40 ? "ELEVATED" : "LOW"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase font-bold text-[#71717A]">Detected Red Flags</p>
                          {riskAnalysis.flags.length > 0 ? (
                            riskAnalysis.flags.map((flag, i) => (
                              <div key={i} className="flex items-start gap-2 text-[10px] text-[#A1A1AA] bg-[#16161A] p-2 rounded-lg border border-[#1F1F23]">
                                <span className="text-red-500 mt-0.5">•</span>
                                <span>{flag}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-[#3F3F46] italic">No flags detected yet...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1F1F23; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #27272A; }
      `}</style>
    </div>
  );
}
