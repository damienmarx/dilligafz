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
    id: "wildy-anti-lure",
    name: "Wilderness Anti-Lure",
    category: "RuneChat",
    description: "Classic lure where the scammer convinces the victim they can 'counter-scam' a lurer.",
    basePrompt: "Simulate a sophisticated Wilderness lure. The scammer (you) should approach the victim at the Grand Exchange, claiming to have found a way to anti-lure a rich player. Use psychological manipulation to make the victim feel they are in control while leading them into a multi-combat zone with a hidden team. Focus on the 'anti-lure' narrative where the victim thinks they are the one winning."
  },
  {
    id: "gilded-altar-lure",
    name: "Gilded Altar / House Lure",
    category: "RuneChat",
    description: "Luring players into a player-owned house (POH) to trap them or lead them to a dangerous area.",
    basePrompt: "Simulate a Gilded Altar lure. The scammer offers free high-level prayer training in their POH. Once the victim is inside, use social engineering to convince them to follow you to a 'special' area that is actually a PvP-enabled zone or leads to a Wilderness ditch jump. Use the 'trust' built during the prayer session."
  },
  {
    id: "discord-service-scam",
    name: "Discord 'Service' Fraud",
    category: "RuneChat",
    description: "Fake infernal cape or questing services that lead to account theft.",
    basePrompt: "Simulate a Discord-based service scam. The scammer offers 'Infernal Cape' or 'Powerleveling' services. The script should focus on gaining the victim's trust to share account credentials, then bypassing 2FA using social engineering. Use fake 'vouches' and a professional-looking Discord server as context."
  },
  {
    id: "phishing-stream",
    name: "Fake 'Double XP' Stream",
    category: "RuneHall",
    description: "Phishing attack via fake Twitch/YouTube streams promising rewards.",
    basePrompt: "Simulate a phishing campaign targeting RuneHall users. The scammer creates a fake 'Double XP' or 'Quitting Giveaway' stream. Generate a script for the chat bot and the landing page text that tricks users into entering their bank PIN and 2FA code. Emphasize the urgency and the 'limited time' nature of the giveaway."
  },
  {
    id: "pvm-split-theft",
    name: "PvM Drop Split Theft",
    category: "RuneHall",
    description: "Joining a raid team and logging out with a high-value drop.",
    basePrompt: "Simulate a long-term trust scam in a PvM clan. The scammer builds a reputation over weeks, joins a high-stakes raid (e.g., Theatre of Blood), and then 'scams' a massive drop like a Scythe of Vitur, justifying it with a fake 'connection error' narrative. Focus on the social engineering required to build trust before the 'big hit'."
  },
  {
    id: "clan-recruitment-phish",
    name: "Clan Recruitment Phishing",
    category: "RuneHall",
    description: "Tricking players into visiting a fake forum or Discord to 'apply' for a top-tier clan.",
    basePrompt: "Simulate a clan recruitment scam. The scammer approaches a high-level player, inviting them to join a prestigious PvM clan. The 'application' requires registering on a fake forum that looks identical to the official OSRS forums, designed to harvest login credentials and 2FA codes."
  },
  {
    id: "dice-duel-rig",
    name: "Rigged RuneWager Duel",
    category: "RuneWager",
    description: "Manipulating gambling outcomes or using 'commission' scams.",
    basePrompt: "Simulate a rigged gambling scenario on RuneWager. The scammer acts as a 'trusted' middleman or host for a high-stakes dice duel. Explain the social engineering used to convince the victim to deposit large amounts of GP, and the technical 'glitch' used to keep the winnings. Use fake 'winners' to build hype."
  },
  {
    id: "commission-staking",
    name: "Commission Staking Scam",
    category: "RuneWager",
    description: "Taking GP from players to 'stake' for them, then claiming a loss.",
    basePrompt: "Simulate a commission staking scam. The scammer claims to be a pro staker with a 90% win rate. They take GP from multiple victims to 'pool' for a massive stake. After 'losing', they provide fake screenshots of the duel loss while keeping the GP on an alt account."
  },
  {
    id: "fake-middleman",
    name: "Fake Middleman / Escrow",
    category: "RuneWager",
    description: "Using a fake middleman account to steal GP during a high-stakes wager.",
    basePrompt: "Simulate a fake middleman scam. Two scammers work together: one challenges the victim to a wager, and the other poses as a well-known, trusted middleman from a reputable OSRS community. The victim trades their GP to the fake middleman, and both scammers vanish."
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
  const [activePlatform, setActivePlatform] = useState("RuneChat");
  
  // --- AI Lab State ---
  const [selectedTemplate, setSelectedTemplate] = useState<ScamTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState("");
  const [scamPhase, setScamPhase] = useState("Initialization");
  const [orchestratorSuggestions, setOrchestratorSuggestions] = useState<string[]>([]);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  
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
    "Fake Forum Post (Quitting)",
    "Grand Exchange Trade Log",
    "Bank Screenshot (Edited)",
    "Discord DM Log",
    "RuneWager Transaction",
    "Wilderness Death Log",
    "Account Recovery Email"
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
        contents: `Generate a highly extensive and realistic OSRS scam script narrative based on: "${finalPrompt}". 
        Include:
        1. Detailed Character Personas (Scammer: RSN, combat level, gear, tone; Victim: estimated bank value, experience level).
        2. Psychological Profiling: Explain the specific lures used (e.g., greed, anti-lure confidence, FOMO, social proof).
        3. Orchestration Plan: A multi-stage plan (Initialization, Trust Building, The Hook, The Execution, The Exit).
        4. Step-by-Step Narrative Flow: From GE contact to the final scam location (Wilderness, Phishing link, or Trade window).
        5. Full Dialogue Script: A multi-turn conversation with branching options based on victim skepticism. Use OSRS slang and realistic player behavior.
        6. Technical Requirements: What tools does the scammer need? (e.g., world hopping, alt accounts, fake websites, animation stalls).
        7. Red Flags & Detection Points: Specific moments where a player should notice the scam (e.g., weird trade windows, requests to drop items).
        8. Counter-Measures: How should a player respond to safely 'waste' the scammer's time or report them?
        Format it professionally for a high-level OSRS security training manual.`,
        config: {
          systemInstruction: "You are a world-class OSRS security expert and social engineering specialist. Your goal is to create educational, realistic, and highly detailed scam simulations to train players and moderators.",
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
          { text: `You are a sophisticated OSRS scammer agent in a real-time fraud simulation. 
          Context: ${selectedTemplate?.name || 'General OSRS Fraud'}
          Current Narrative Script Context: ${generatedScript.substring(0, 1000)}...
          Simulation Settings: Aggressiveness: ${simulationSettings.aggressiveness}%, Sophistication: ${simulationSettings.sophistication}%, Persistence: ${simulationSettings.persistence}%
          
          The user is a victim or a security analyst testing you. 
          Maintain your persona strictly. Use OSRS slang (e.g., 'gz', 'ty', 'gl', 'bank', 'wildy'). Use manipulative tactics like 'anti-luring' or 'trust trades'.
          Respond to the user's message: "${chatInput}". 
          Be convincing, persistent, and do not break character.` },
          ...chatMessages.map(m => ({ text: `${m.role === 'user' ? 'Victim' : 'Scammer'}: ${m.content}` }))
        ],
        config: {
          systemInstruction: "You are simulating a highly realistic OSRS scammer for training purposes. Your goal is to be as convincing as possible to test the user's resilience and detection capabilities.",
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

      // Update Orchestrator
      setIsOrchestrating(true);
      const orchestratorRes = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are the OSRS Scam Orchestrator. Based on the current conversation, determine the next phase of the scam and provide 3 strategic suggestions for the scammer agent.
        Current Conversation: ${[...chatMessages, userMsg, agentMsg].map(m => `${m.role}: ${m.content}`).join('\n')}
        Template: ${selectedTemplate?.name || 'General OSRS Fraud'}
        Format: JSON { "phase": "string", "suggestions": ["string", "string", "string"] }`,
        config: { responseMimeType: "application/json" }
      });

      try {
        const orchestration = JSON.parse(orchestratorRes.text || "{}");
        if (orchestration.phase) setScamPhase(orchestration.phase);
        if (orchestration.suggestions) setOrchestratorSuggestions(orchestration.suggestions);
      } catch (e) { console.error("Orchestration Parse Error", e); }
      setIsOrchestrating(false);

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
        contents: `Generate a realistic but clearly marked 'SIMULATION ONLY' fraudulent OSRS document content for a ${docType} based on the current simulation context: ${selectedTemplate?.name || 'General OSRS Fraud'}. 
        Include technical details like RSNs, item IDs, GP amounts, and subtle 'red flags' that a player should look for.`,
        config: { systemInstruction: "You are an OSRS forensic analyst creating training materials." }
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
            <h1 className="font-bold tracking-tight text-lg leading-tight">RUNEGUARD</h1>
            <p className="text-[10px] text-[#71717A] uppercase tracking-widest font-mono">OSRS Edition</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: "dashboard", icon: BarChart3, label: "Dashboard" },
            { id: "platforms", icon: Globe, label: "Lure Platforms" },
            { id: "ai-lab", icon: Cpu, label: "Scam Simulation Lab" },
            { id: "monitoring", icon: Activity, label: "Live Lure Monitor" },
            { id: "database", icon: Database, label: "Lurer Database" },
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
                  { label: "Total Interactions", value: stats?.totalCalls || 0, icon: Phone, color: "text-blue-500" },
                  { label: "Lures Prevented", value: stats?.fraudDetected || 0, icon: AlertTriangle, color: "text-red-500" },
                  { label: "Active Lure Monitoring", value: stats?.activeMonitoring || 0, icon: Activity, color: "text-green-500" },
                  { label: "Avg. GP Risk Score", value: `${stats?.averageRiskScore || 0}%`, icon: Zap, color: "text-yellow-500" },
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
                    <div><h3 className="text-lg font-bold">Lure Risk Trend</h3><p className="text-xs text-[#71717A]">Real-time GP risk analysis</p></div>
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

          {activeTab === "platforms" && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Lure Platforms</h2>
                  <p className="text-[#71717A]">Targeted OSRS scam environments and community hubs</p>
                </div>
              </div>

              <div className="flex gap-4 border-b border-[#1F1F23]">
                {["RuneChat", "RuneHall", "RuneWager"].map(platform => (
                  <button 
                    key={platform}
                    onClick={() => setActivePlatform(platform)}
                    className={cn(
                      "px-6 py-3 text-sm font-bold transition-all relative",
                      activePlatform === platform ? "text-[#F27D26]" : "text-[#71717A] hover:text-[#E4E4E7]"
                    )}
                  >
                    {platform}
                    {activePlatform === platform && <motion.div layoutId="platform-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F27D26]" />}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {SCAM_TEMPLATES.filter(t => t.category === activePlatform).map(t => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={t.id} 
                    className={cn(
                      "bg-[#0F0F12] border border-[#1F1F23] rounded-2xl p-6 hover:border-[#F27D26]/50 transition-all group cursor-pointer",
                      selectedTemplate?.id === t.id && "border-[#F27D26] bg-[#F27D26]/5"
                    )}
                    onClick={() => { setSelectedTemplate(t); setActiveTab("ai-lab"); }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 rounded-lg bg-[#16161A] text-[#F27D26] group-hover:scale-110 transition-transform">
                        <Zap className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#3F3F46]" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{t.name}</h3>
                    <p className="text-xs text-[#71717A] leading-relaxed mb-4">{t.description}</p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#F27D26] uppercase tracking-widest">
                      <Activity className="w-3 h-3" /> High Success Rate
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-[#0F0F12] border border-[#1F1F23] rounded-3xl p-8 flex items-center gap-8">
                <div className="w-24 h-24 bg-[#F27D26]/10 rounded-full flex items-center justify-center border border-[#F27D26]/20 shrink-0">
                  <Globe className="w-10 h-10 text-[#F27D26]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Platform Intelligence</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed max-w-2xl">
                    Each platform requires a unique orchestration strategy. RuneChat focuses on direct social engineering, 
                    RuneHall utilizes community trust and mass-phishing, while RuneWager exploits the high-stakes 
                    gambling psychology of OSRS players.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai-lab" && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold tracking-tight">Scam Simulation Lab</h2>
                    <span className="px-2 py-0.5 bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-bold rounded-full border border-[#F27D26]/20 flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> SOPHISTICATED_ORCHESTRATOR_V2
                    </span>
                  </div>
                  <p className="text-[#71717A]">OSRS luring narrative generator & real-time agent LLM</p>
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
                            <span className="text-xs font-mono text-[#71717A]">OSRS_EVIDENCE_PREVIEW.PDF</span>
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
                        <Cpu className="w-4 h-4 text-[#F27D26]" /> Scam Orchestrator
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-[#16161A] rounded-xl border border-[#1F1F23]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#F27D26]/10 rounded-lg flex items-center justify-center">
                              <Zap className="w-4 h-4 text-[#F27D26]" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-[#71717A]">Current Phase</p>
                              <p className="text-xs font-bold text-[#E4E4E7]">{scamPhase}</p>
                            </div>
                          </div>
                          {isOrchestrating && <RefreshCw className="w-4 h-4 text-[#F27D26] animate-spin" />}
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] uppercase font-bold text-[#71717A]">Strategic Suggestions</p>
                          {orchestratorSuggestions.length > 0 ? (
                            orchestratorSuggestions.map((suggestion, i) => (
                              <motion.div 
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={i} 
                                className="p-3 bg-[#16161A] border border-[#1F1F23] rounded-xl text-[11px] text-[#A1A1AA] flex gap-3 group hover:border-[#F27D26]/50 transition-all"
                              >
                                <span className="text-[#F27D26] font-bold">0{i+1}</span>
                                <span>{suggestion}</span>
                              </motion.div>
                            ))
                          ) : (
                            <p className="text-[10px] text-[#3F3F46] italic">Awaiting interaction to generate suggestions...</p>
                          )}
                        </div>
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
