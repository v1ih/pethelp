import { useState, useEffect, useRef } from "react";
import {
  Bell, Settings, LogOut, PawPrint, ChevronRight, Plus, Star,
  Upload, Calendar, FileText, Syringe, ClipboardList, Home,
  Users, Stethoscope, Building2, Copy, Check, X, Trash2,
  Edit3, Clock, Phone, Mail, MapPin, Shield, AlertTriangle,
  Eye, EyeOff, ChevronDown, MoreVertical, Search, Filter,
  MessageCircle, Moon, Sun, User, Award, Tag, Lock, Unlock,
  CheckCircle, XCircle, Info, Zap, BookOpen, Heart, BellOff
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "info" | "warning";
interface Toast { id: string; message: string; type: ToastType }
interface Notification { id: string; title: string; body: string; time: string; read: boolean; icon: "bell" | "check" | "alert" | "info" }

// ─── Toast System ─────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = (message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  return { toasts, show };
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  };
  const bg: Record<ToastType, string> = {
    success: "border-emerald-200 dark:border-emerald-800",
    error: "border-red-200 dark:border-red-800",
    info: "border-blue-200 dark:border-blue-800",
    warning: "border-amber-200 dark:border-amber-800",
  };
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2.5 bg-card text-card-foreground border ${bg[t.type]} shadow-lg rounded-xl px-4 py-3 text-sm font-medium min-w-[260px] pointer-events-auto`}
          style={{ animation: "slideInRight 0.25s ease" }}>
          {icons[t.type]}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────
const initialNotifications: Notification[] = [
  { id: "1", title: "Consulta confirmada", body: "Bolinha — 28/06 às 14:30 com Dr. Lucas Ferreira", time: "Agora mesmo", read: false, icon: "check" },
  { id: "2", title: "Vacina vencendo", body: "Giárdia do Bolinha vence em 3 dias. Agende o reforço!", time: "2h atrás", read: false, icon: "alert" },
  { id: "3", title: "Novo exame disponível", body: "Hemograma de Mingau foi carregado pela clínica.", time: "Ontem", read: true, icon: "info" },
  { id: "4", title: "Avalie sua consulta", body: "Como foi o atendimento da Dra. Mariana Costa?", time: "2 dias atrás", read: true, icon: "bell" },
];

function NotificationPanel({
  notifications, onRead, onReadAll, onClose
}: {
  notifications: Notification[];
  onRead: (id: string) => void;
  onReadAll: () => void;
  onClose: () => void;
}) {
  const iconMap = {
    bell: <Bell className="w-3.5 h-3.5 text-primary" />,
    check: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
    alert: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
    info: <Info className="w-3.5 h-3.5 text-blue-500" />,
  };
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-[150] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-sm">Notificações</span>
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button onClick={onReadAll} className="text-xs text-primary hover:underline font-medium">Marcar todas</button>
          )}
          <button onClick={onClose} className="ml-2 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <BellOff className="w-8 h-8" />
            <span className="text-sm">Nenhuma notificação</span>
          </div>
        ) : (
          notifications.map(n => (
            <button
              key={n.id}
              onClick={() => onRead(n.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border/50 last:border-0 ${!n.read ? "bg-primary/5" : ""}`}
            >
              <div className={`mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${!n.read ? "bg-primary/15" : "bg-muted"}`}>
                {iconMap[n.icon]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{n.time}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-7 h-7", md: "w-8 h-8", lg: "w-10 h-10" };
  const t = { sm: "text-base", md: "text-lg", lg: "text-xl" };
  return (
    <div className="flex items-center gap-2">
      <div className={`${s[size]} rounded-xl bg-primary flex items-center justify-center`}>
        <PawPrint className="w-4 h-4 text-primary-foreground" />
      </div>
      <span className={`font-display font-bold ${t[size]} text-foreground tracking-tight`}>
        Pet<span className="text-primary">Help</span>
      </span>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({
  userName, onLogout, darkMode, onToggleDark, onOpenSettings,
  notifications, onReadNotif, onReadAllNotifs
}: {
  userName: string;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onOpenSettings: () => void;
  notifications: Notification[];
  onReadNotif: (id: string) => void;
  onReadAllNotifs: () => void;
}) {
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-card/80 backdrop-blur-md border-b border-border flex items-center px-4 lg:px-6 gap-4">
      <Logo size="sm" />
      <div className="flex-1" />
      <span className="text-sm text-muted-foreground hidden sm:block">
        Olá, <span className="font-semibold text-foreground">{userName}</span>
      </span>
      <div className="flex items-center gap-1">
        <button onClick={onToggleDark} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors" aria-label="Alternar tema">
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifs(p => !p)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors relative"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
            )}
          </button>
          {showNotifs && (
            <NotificationPanel
              notifications={notifications}
              onRead={(id) => { onReadNotif(id); }}
              onReadAll={() => { onReadAllNotifs(); }}
              onClose={() => setShowNotifs(false)}
            />
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => { onOpenSettings(); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Configurações"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button onClick={onLogout} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-destructive" aria-label="Sair">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

// ─── WhatsApp FAB ─────────────────────────────────────────────────────────────
function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/5511999999999"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="w-6 h-6 text-white fill-white" />
    </a>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, color = "primary" }: { children: React.ReactNode; color?: "primary" | "accent" | "muted" | "success" | "danger" }) {
  const map = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-amber-700 dark:text-amber-400",
    muted: "bg-muted text-muted-foreground",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    danger: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold font-mono ${map[color]}`}>
      {children}
    </span>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          onClick={() => onChange?.(s)}
          className={`transition-colors ${s <= value ? "text-accent" : "text-muted"} ${onChange ? "hover:text-accent cursor-pointer" : "cursor-default"}`}
          aria-label={`${s} estrelas`}
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card rounded-2xl border border-border ${className}`}>{children}</div>;
}

// ─── Section Title ────────────────────────────────────────────────────────────
function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-display font-bold text-lg text-foreground">{children}</h2>
      {action}
    </div>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function InputField({
  label, type = "text", placeholder, value, onChange, icon: Icon, required, hint, readOnly
}: {
  label?: string; type?: string; placeholder?: string; value?: string;
  onChange?: (v: string) => void; icon?: React.FC<{ className?: string }>;
  required?: boolean; hint?: string; readOnly?: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const inputType = type === "password" ? (showPw ? "text" : "password") : type;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-semibold text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow
            ${readOnly
              ? "bg-muted border-border cursor-not-allowed text-muted-foreground select-none"
              : "bg-input-background border-border"
            }
            ${Icon ? "pl-9" : ""}
            ${type === "password" ? "pr-9" : ""}
          `}
        />
        {readOnly && (
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
        )}
        {type === "password" && !readOnly && (
          <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
function Button({
  children, onClick, variant = "primary", size = "md", icon: Icon, className = "", disabled, type = "button"
}: {
  children?: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg"; icon?: React.FC<{ className?: string }>; className?: string; disabled?: boolean; type?: "button" | "submit";
}) {
  const base = "inline-flex items-center gap-2 rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${checked ? "bg-primary" : "bg-switch-background"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}

// ─── Language Tab (shared) ────────────────────────────────────────────────────
function LanguageTab() {
  const languages = [
    { code: "pt-BR", name: "Português (Brasil)", flag: "🇧🇷", active: true },
    { code: "en-US", name: "English (US)", flag: "🇺🇸", active: false },
    { code: "es-ES", name: "Español", flag: "🇪🇸", active: false },
    { code: "fr-FR", name: "Français", flag: "🇫🇷", active: false },
  ];
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-muted-foreground" />
        <div>
          <p className="font-semibold text-foreground">Idioma do aplicativo</p>
          <p className="text-xs text-muted-foreground">Somente Português (Brasil) está disponível no momento</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {languages.map(l => (
          <div
            key={l.code}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${l.active ? "border-primary bg-primary/5" : "border-border opacity-50 cursor-not-allowed"}`}
          >
            <span className="text-xl">{l.flag}</span>
            <div className="flex-1">
              <p className={`text-sm font-medium ${l.active ? "text-foreground" : "text-muted-foreground"}`}>{l.name}</p>
            </div>
            {l.active ? (
              <Badge color="success">Ativo</Badge>
            ) : (
              <Badge color="muted">Em breve</Badge>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Forgot Password Modal ────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose, toast }: { onClose: () => void; toast: (m: string, t?: ToastType) => void }) {
  const [step, setStep] = useState<"email" | "code" | "newpw">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const handleSend = () => {
    if (!email.includes("@")) { toast("E-mail inválido", "error"); return; }
    toast("Código enviado para seu e-mail!");
    setStep("code");
  };
  const handleVerify = () => {
    if (code.length < 6) { toast("Código inválido", "error"); return; }
    setStep("newpw");
  };
  const handleReset = () => {
    if (!newPw || newPw.length < 8) { toast("A senha deve ter pelo menos 8 caracteres", "error"); return; }
    if (newPw !== confirmPw) { toast("As senhas não coincidem", "error"); return; }
    toast("Senha redefinida com sucesso!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-sm p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-foreground">Recuperar senha</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "email" && "Informe seu e-mail cadastrado"}
              {step === "code" && "Digite o código recebido"}
              {step === "newpw" && "Crie uma nova senha"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {(["email", "code", "newpw"] as const).map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${
              s === step ? "bg-primary" :
              (step === "code" && i === 0) || step === "newpw" ? "bg-primary/40" : "bg-muted"
            }`} />
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {step === "email" && (
            <>
              <InputField label="E-mail cadastrado" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} icon={Mail} required />
              <Button onClick={handleSend} className="w-full justify-center">Enviar código</Button>
            </>
          )}
          {step === "code" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground">Código de verificação<span className="text-destructive ml-0.5">*</span></label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  className="bg-input-background rounded-xl border border-border px-3 py-3 text-center font-mono text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground text-center">Código enviado para <strong>{email}</strong></p>
              </div>
              <Button onClick={handleVerify} className="w-full justify-center">Verificar código</Button>
              <button onClick={() => toast("Novo código enviado!")} className="text-xs text-primary hover:underline text-center">Reenviar código</button>
            </>
          )}
          {step === "newpw" && (
            <>
              <InputField label="Nova senha" type="password" placeholder="Mínimo 8 caracteres" value={newPw} onChange={setNewPw} icon={Lock} required hint="Use letras, números e símbolos para uma senha forte." />
              <InputField label="Confirmar nova senha" type="password" placeholder="Repita a senha" value={confirmPw} onChange={setConfirmPw} icon={Lock} required />
              <Button onClick={handleReset} className="w-full justify-center">Redefinir senha</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Nav Tab Bar ──────────────────────────────────────────────────────────────
function NavBar({ tabs, active, onChange }: { tabs: { id: string; label: string; icon: React.FC<{ className?: string }> }[]; active: string; onChange: (id: string) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex lg:hidden">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${active === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <t.icon className="w-5 h-5" />
        </button>
      ))}
    </nav>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ tabs, active, onChange }: { tabs: { id: string; label: string; icon: React.FC<{ className?: string }> }[]; active: string; onChange: (id: string) => void }) {
  return (
    <aside className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 bg-sidebar border-r border-sidebar-border flex-col py-4 px-3 gap-1 z-40">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active === t.id ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
        >
          <t.icon className="w-4 h-4 shrink-0" />
          {t.label}
        </button>
      ))}
    </aside>
  );
}

// ─── Layout Wrapper ───────────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-14 pb-20 lg:pb-0 lg:pl-56 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">{children}</div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

function AuthScreen({ onLogin, toast }: { onLogin: (role: "tutor" | "vet" | "clinic") => void; toast: (m: string, t?: ToastType) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"tutor" | "vet" | "clinic">("tutor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const handleLogin = () => {
    if (!email || !password) { toast("Preencha todos os campos obrigatórios", "error"); return; }
    toast("Login realizado com sucesso!");
    onLogin(role);
  };
  const handleRegister = () => {
    if (!name || !email || !phone || !password) { toast("Preencha todos os campos obrigatórios", "error"); return; }
    toast("Conta criada! Verifique seu e-mail.");
    onLogin(role);
  };

  const roles = [
    { id: "tutor", label: "Tutor", icon: Heart },
    { id: "vet", label: "Veterinário", icon: Stethoscope },
    { id: "clinic", label: "Clínica", icon: Building2 },
  ] as const;

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4"><Logo size="lg" /></div>
            <p className="text-muted-foreground text-sm">Cuidado veterinário conectado</p>
          </div>

          <Card className="p-6">
            <div className="flex gap-2 mb-6">
              {roles.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${role === r.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  <r.icon className="w-4 h-4" />
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex border-b border-border mb-5">
              {(["login", "register"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                  {t === "login" ? "Entrar" : "Cadastrar"}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              {tab === "register" && (
                <>
                  <InputField label="Nome completo" placeholder="Ana Souza" value={name} onChange={setName} icon={User} required />
                  <InputField label="Telefone" placeholder="(11) 99999-9999" value={phone} onChange={setPhone} icon={Phone} required />
                </>
              )}
              <InputField label="E-mail" type="email" placeholder="ana@email.com" value={email} onChange={setEmail} icon={Mail} required />
              <InputField label="Senha" type="password" placeholder="••••••••" value={password} onChange={setPassword} icon={Lock} required />

              {tab === "login" && (
                <button onClick={() => setShowForgot(true)} className="text-xs text-primary text-right hover:underline">
                  Esqueci minha senha
                </button>
              )}

              <Button onClick={tab === "login" ? handleLogin : handleRegister} size="lg" className="w-full justify-center mt-1">
                {tab === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} toast={toast} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TUTOR SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

const mockPets = [
  { id: "1", name: "Bolinha", species: "Cão", breed: "Labrador", age: 3, weight: "28kg", photo: "photo-1543466835-00a7907e9de1" },
  { id: "2", name: "Mingau", species: "Gato", breed: "Persa", age: 5, weight: "4.2kg", photo: "photo-1514888286974-6c03e2ca1dba" },
];

const mockConsultas = [
  { id: "1", date: "12/06/2025", vet: "Dr. Lucas Ferreira", clinic: "Clínica PetVida", diagnosis: "Dermatite alérgica", treatment: "Prednisolona 20mg por 7 dias" },
  { id: "2", date: "03/04/2025", vet: "Dra. Mariana Costa", clinic: "Hospital Pet Center", diagnosis: "Otite externa", treatment: "Otosporin 5 gotas por 10 dias" },
];

const mockVaccines = [
  { name: "V10 (Polivalente)", date: "10/01/2025", nextDue: "10/01/2026", status: "ok" },
  { name: "Antirrábica", date: "15/03/2025", nextDue: "15/03/2026", status: "ok" },
  { name: "Giárdia", date: "20/11/2024", nextDue: "20/11/2025", status: "overdue" },
  { name: "Gripe Canina", date: "05/06/2025", nextDue: "05/06/2026", status: "ok" },
];

const mockAgendamentos = [
  { id: "1", date: "28/06/2025", time: "14:30", vet: "Dr. Lucas Ferreira", clinic: "Clínica PetVida", pet: "Bolinha", type: "Consulta de rotina" },
  { id: "2", date: "10/07/2025", time: "09:00", vet: "Dra. Mariana Costa", clinic: "Hospital Pet Center", pet: "Mingau", type: "Vacinação" },
];

const mockExams = [
  { id: "1", name: "Hemograma Completo", date: "12/06/2025", type: "PDF", pet: "Bolinha" },
  { id: "2", name: "Raio-X Tórax", date: "12/06/2025", type: "PNG", pet: "Bolinha" },
  { id: "3", name: "Ultrassom Abdominal", date: "03/04/2025", type: "PDF", pet: "Mingau" },
];

function TutorDashboard({ onScreenChange }: { onScreenChange: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">Meus Pets</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie a saúde dos seus companheiros</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pets", value: "2", icon: PawPrint, color: "text-primary bg-primary/10" },
          { label: "Consultas", value: "8", icon: Stethoscope, color: "text-accent bg-accent/15" },
          { label: "Vacinas", value: "4", icon: Syringe, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Exames", value: "3", icon: FileText, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-2`}><s.icon className="w-4 h-4" /></div>
            <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>
      <div>
        <SectionTitle action={<Button variant="primary" size="sm" icon={Plus}>Adicionar pet</Button>}>
          Seus pets
        </SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          {mockPets.map(pet => (
            <Card key={pet.id} className="p-4 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => onScreenChange("prontuario")}>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted shrink-0">
                  <img src={`https://images.unsplash.com/${pet.photo}?w=128&h=128&fit=crop&auto=format`} alt={pet.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-foreground">{pet.name}</h3>
                    <Badge color="primary">{pet.species}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{pet.breed}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{pet.age} anos</span>
                    <span className="text-xs text-muted-foreground">{pet.weight}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" icon={ClipboardList} onClick={(e) => { e?.stopPropagation(); onScreenChange("prontuario"); }}>Prontuário</Button>
                <Button variant="ghost" size="sm" icon={Syringe} onClick={(e) => { e?.stopPropagation(); onScreenChange("vacinas"); }}>Vacinas</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Próxima consulta</SectionTitle>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{mockAgendamentos[0].type}</p>
              <p className="text-sm text-muted-foreground">{mockAgendamentos[0].vet} · {mockAgendamentos[0].clinic}</p>
              <p className="text-sm font-semibold text-primary mt-1">{mockAgendamentos[0].date} às {mockAgendamentos[0].time}</p>
            </div>
            <Badge color="success">Confirmado</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function TutorProntuario() {
  const [selectedPet, setSelectedPet] = useState(mockPets[0]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Prontuário</h1>
      <div className="flex gap-2">
        {mockPets.map(p => (
          <button key={p.id} onClick={() => setSelectedPet(p)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${selectedPet.id === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
            <div className="w-6 h-6 rounded-full overflow-hidden bg-muted">
              <img src={`https://images.unsplash.com/${p.photo}?w=48&h=48&fit=crop&auto=format`} alt={p.name} className="w-full h-full object-cover" />
            </div>
            {p.name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {mockConsultas.map((c, i) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                {i < mockConsultas.length - 1 && <div className="w-0.5 h-16 bg-border mt-1" />}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{c.diagnosis}</p>
                    <p className="text-sm text-muted-foreground">{c.vet} · {c.clinic}</p>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{c.date}</span>
                </div>
                <div className="mt-2 p-2.5 bg-muted rounded-xl">
                  <p className="text-xs text-muted-foreground font-semibold mb-0.5">Tratamento</p>
                  <p className="text-sm text-foreground">{c.treatment}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TutorVacinas() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Carteira de Vacinação</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {mockVaccines.map(v => (
          <Card key={v.name} className={`p-4 ${v.status === "overdue" ? "border-destructive/30 bg-destructive/5" : ""}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${v.status === "ok" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-destructive/10"}`}>
                <Syringe className={`w-4 h-4 ${v.status === "ok" ? "text-emerald-600" : "text-destructive"}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground text-sm">{v.name}</p>
                  <Badge color={v.status === "ok" ? "success" : "danger"}>{v.status === "ok" ? "Em dia" : "Vencida"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Aplicada: <span className="font-mono">{v.date}</span></p>
                <p className="text-xs text-muted-foreground">Reforço: <span className="font-mono font-semibold">{v.nextDue}</span></p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TutorExames({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const handleUpload = () => toast("Exame enviado com sucesso!");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Exames</h1>
        <Button icon={Upload} onClick={handleUpload}>Enviar exame</Button>
      </div>
      <Card className="p-6 border-dashed border-2 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/60 transition-colors" onClick={handleUpload}>
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Arraste o arquivo ou clique para selecionar</p>
          <p className="text-sm text-muted-foreground">PDF, JPG, PNG — até 20MB</p>
        </div>
      </Card>
      <div className="flex flex-col gap-3">
        {mockExams.map(e => (
          <Card key={e.id} className="p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${e.type === "PDF" ? "bg-red-50 dark:bg-red-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}>
              <FileText className={`w-4 h-4 ${e.type === "PDF" ? "text-red-600" : "text-blue-600"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">{e.name}</p>
              <p className="text-xs text-muted-foreground">{e.pet} · {e.date}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="muted">{e.type}</Badge>
              <Button variant="ghost" size="sm">Ver</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TutorAgendamentos({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  const handleReview = (id: string) => {
    if (!ratings[id]) { toast("Selecione uma avaliação de 1 a 5 estrelas", "error"); return; }
    setReviewed(p => ({ ...p, [id]: true }));
    toast("Avaliação enviada! Obrigado.");
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Agendamentos</h1>
      <div className="flex flex-col gap-4">
        {mockAgendamentos.map(a => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground">{a.type}</p>
                  <Badge color={a.date > "25/06/2025" ? "primary" : "success"}>
                    {a.date > "25/06/2025" ? "Agendado" : "Realizado"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{a.vet} · {a.clinic}</p>
                <p className="text-sm text-muted-foreground">{a.pet}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm font-semibold text-foreground">{a.date}</p>
                <p className="font-mono text-xs text-muted-foreground">{a.time}</p>
              </div>
            </div>
            {a.date <= "25/06/2025" && !reviewed[a.id] && (
              <div className="border-t border-border pt-3">
                <p className="text-sm font-semibold text-foreground mb-2">Avaliar atendimento</p>
                <StarRating value={ratings[a.id] || 0} onChange={v => setRatings(p => ({ ...p, [a.id]: v }))} />
                <textarea
                  className="w-full mt-2 bg-input-background rounded-xl border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={2}
                  placeholder="Conte como foi a consulta..."
                  value={comments[a.id] || ""}
                  onChange={e => setComments(p => ({ ...p, [a.id]: e.target.value }))}
                />
                <Button size="sm" className="mt-2" onClick={() => handleReview(a.id)}>Enviar avaliação</Button>
              </div>
            )}
            {reviewed[a.id] && (
              <div className="border-t border-border pt-3 flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                Avaliação enviada — obrigado!
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function TutorConfig({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [deleteWord, setDeleteWord] = useState("");
  const [tab, setTab] = useState<"profile" | "lang" | "danger">("profile");
  const [name, setName] = useState("Ana Souza");
  const [phone, setPhone] = useState("(11) 98765-4321");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Configurações</h1>
      <div className="flex gap-2 border-b border-border pb-0">
        {([["profile", "Perfil"], ["lang", "Idioma"], ["danger", "Zona de Perigo"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <Card className="p-5 flex flex-col gap-4">
          <InputField label="Nome completo" placeholder="Ana Souza" value={name} onChange={setName} icon={User} required />
          <InputField label="E-mail" type="email" value="ana.souza@email.com" icon={Mail} readOnly hint="O e-mail não pode ser alterado. Entre em contato com o suporte se necessário." />
          <InputField label="Telefone" placeholder="(11) 99999-9999" value={phone} onChange={setPhone} icon={Phone} required />
          <Button onClick={() => toast("Perfil atualizado!")} className="self-start">Salvar alterações</Button>
        </Card>
      )}

      {tab === "lang" && <LanguageTab />}

      {tab === "danger" && (
        <Card className="p-5 border-destructive/30 bg-destructive/5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-display font-bold">Zona de Perigo</p>
          </div>
          <p className="text-sm text-muted-foreground">Esta ação é <strong>permanente e irreversível</strong>. Todos os dados dos seus pets serão removidos.</p>
          <InputField label='Digite "EXCLUIR" para confirmar' placeholder="EXCLUIR" value={deleteWord} onChange={setDeleteWord} icon={Trash2} required />
          <Button variant="danger" disabled={deleteWord !== "EXCLUIR"} onClick={() => toast("Conta excluída. Até logo!", "info")} icon={Trash2}>
            Excluir minha conta permanentemente
          </Button>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VET SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

const mockVetPatients = [
  { name: "Bolinha", owner: "Ana Souza", species: "Cão", breed: "Labrador", date: "28/06/2025", time: "14:30" },
  { name: "Mel", owner: "Carlos Pereira", species: "Cão", breed: "Golden", date: "28/06/2025", time: "15:30" },
  { name: "Mingau", owner: "Beatriz Lima", species: "Gato", breed: "Persa", date: "29/06/2025", time: "09:00" },
];

function VetDashboard({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [urgency, setUrgency] = useState(false);
  const [agendaMode, setAgendaMode] = useState<"autonoma" | "clinica">("autonoma");
  const [vetPass, setVetPass] = useState("");
  const [passEntered, setPassEntered] = useState(false);

  const handleVetPass = () => {
    if (vetPass.length < 6) { toast("Código inválido", "error"); return; }
    setPassEntered(true);
    toast("Acesso liberado! Prontuário carregado.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Dashboard Veterinário</h1>
          <p className="text-muted-foreground text-sm mt-1">Dr. Lucas Ferreira · CRMV-SP 12345</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch checked={urgency} onChange={v => { setUrgency(v); toast(v ? "Urgência ativada!" : "Urgência desativada", v ? "success" : "info"); }} />
          <span className={`text-xs font-semibold ${urgency ? "text-destructive" : "text-muted-foreground"}`}>
            {urgency ? "🚨 Urgência ATIVA" : "Urgência inativa"}
          </span>
        </div>
      </div>

      <Card className="p-3">
        <p className="text-xs text-muted-foreground mb-2 font-semibold">Modo de agenda</p>
        <div className="flex gap-2">
          {(["autonoma", "clinica"] as const).map(m => (
            <button key={m} onClick={() => setAgendaMode(m)} className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${agendaMode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              {m === "autonoma" ? "Autônoma" : "Clínica vinculada"}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <p className="font-semibold text-foreground text-sm">Vet-Pass</p>
        </div>
        {!passEntered ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Código do tutor"
              value={vetPass}
              onChange={e => setVetPass(e.target.value.toUpperCase())}
              className="flex-1 bg-input-background rounded-xl border border-border px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={8}
            />
            <Button onClick={handleVetPass} icon={Unlock}>Acessar</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" />
              Prontuário de Bolinha (Tutor: Ana Souza)
            </div>
            {mockConsultas.map(c => (
              <div key={c.id} className="bg-card rounded-xl p-3 border border-border">
                <div className="flex justify-between">
                  <p className="text-sm font-semibold text-foreground">{c.diagnosis}</p>
                  <span className="text-xs font-mono text-muted-foreground">{c.date}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{c.treatment}</p>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={Plus}>Registrar nova consulta</Button>
            <Button variant="ghost" size="sm" onClick={() => { setPassEntered(false); setVetPass(""); }}>Encerrar sessão</Button>
          </div>
        )}
      </Card>

      <div>
        <SectionTitle>Agenda de hoje</SectionTitle>
        <div className="flex flex-col gap-3">
          {mockVetPatients.filter(p => p.date === "28/06/2025").map((p, i) => (
            <Card key={i} className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{p.name} <span className="text-muted-foreground font-normal">· {p.owner}</span></p>
                <p className="text-xs text-muted-foreground">{p.species} · {p.breed}</p>
              </div>
              <span className="font-mono text-sm text-foreground">{p.time}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function VetAgenda({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const days = ["Seg 23/06", "Ter 24/06", "Qua 25/06", "Qui 26/06", "Sex 27/06", "Sáb 28/06"];
  const times = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
  const blocked = ["09:00-Qua 25/06", "14:00-Sex 27/06"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Agenda</h1>
        <Button icon={Plus} onClick={() => setShowAdd(true)}>Novo horário</Button>
      </div>
      {showAdd && (
        <Card className="p-5 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-foreground">Adicionar horário</p>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <InputField label="Data" type="date" required />
            <InputField label="Hora" type="time" required />
            <InputField label="Tipo de atendimento" placeholder="Consulta, Retorno..." required />
            <InputField label="Duração (min)" placeholder="30" />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => { setShowAdd(false); toast("Horário adicionado!"); }}>Salvar</Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </Card>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[480px]">
          <thead>
            <tr>
              <th className="w-16 text-left py-2 text-muted-foreground font-mono pr-3">Hora</th>
              {days.map(d => <th key={d} className="text-center py-2 font-semibold text-foreground px-1">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {times.map(time => (
              <tr key={time} className="border-t border-border">
                <td className="py-2 text-muted-foreground font-mono pr-3">{time}</td>
                {days.map(day => {
                  const key = `${time}-${day}`;
                  const isBlocked = blocked.includes(key);
                  const hasPatient = mockVetPatients.some(p => p.time === time && day === "Sáb 28/06");
                  return (
                    <td key={day} className="px-1 py-1.5">
                      {hasPatient ? (
                        <div className="bg-primary/15 border border-primary/30 rounded-lg px-2 py-1 text-primary font-semibold text-center cursor-pointer hover:bg-primary/25">Bolinha</div>
                      ) : isBlocked ? (
                        <div className="bg-muted border border-border rounded-lg px-2 py-1 text-muted-foreground text-center" title="Bloqueado"><Lock className="w-3 h-3 mx-auto" /></div>
                      ) : (
                        <button onClick={() => toast("Horário selecionado")} className="w-full h-7 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VetConfig({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [deleteWord, setDeleteWord] = useState("");
  const [tab, setTab] = useState<"profile" | "lang" | "clinics" | "danger">("profile");
  const [tags, setTags] = useState(["Clínica Geral", "Dermatologia"]);
  const [newTag, setNewTag] = useState("");
  const [vetName, setVetName] = useState("Dr. Lucas Ferreira");
  const [crmv, setCrmv] = useState("12345");
  const [uf, setUf] = useState("SP");
  const [bio, setBio] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Configurações</h1>
      <div className="flex gap-1 flex-wrap border-b border-border pb-0">
        {([["profile", "Perfil"], ["lang", "Idioma"], ["clinics", "Clínicas"], ["danger", "Zona de Perigo"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <Card className="p-5 flex flex-col gap-4">
          <InputField label="Nome completo" placeholder="Dr. Lucas Ferreira" value={vetName} onChange={setVetName} icon={User} required />
          <InputField label="E-mail" type="email" value="lucas.ferreira@email.com" icon={Mail} readOnly hint="O e-mail não pode ser alterado. Entre em contato com o suporte se necessário." />
          <div className="grid sm:grid-cols-2 gap-4">
            <InputField label="CRMV" placeholder="12345" value={crmv} onChange={setCrmv} required />
            <InputField label="UF" placeholder="SP" value={uf} onChange={setUf} required />
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground block mb-1.5">
              Especialidades<span className="text-destructive ml-0.5">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 bg-primary/10 text-primary rounded-lg px-2.5 py-1 text-xs font-semibold">
                  <Tag className="w-3 h-3" />{t}
                  <button onClick={() => setTags(p => p.filter(x => x !== t))} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-input-background rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Adicionar especialidade..."
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newTag) { setTags(p => [...p, newTag]); setNewTag(""); } }}
              />
              <Button size="sm" variant="secondary" onClick={() => { if (newTag) { setTags(p => [...p, newTag]); setNewTag(""); } }}>Adicionar</Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground block mb-1.5">Biografia</label>
            <textarea
              className="w-full bg-input-background rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={3}
              placeholder="Especialista em clínica médica com 10 anos de experiência..."
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>
          <Button onClick={() => toast("Perfil atualizado!")} className="self-start">Salvar alterações</Button>
        </Card>
      )}

      {tab === "lang" && <LanguageTab />}

      {tab === "clinics" && (
        <Card className="p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-foreground">Clínicas vinculadas</p>
          {[{ name: "Clínica PetVida", cnpj: "12.345.678/0001-90" }, { name: "Hospital Pet Center", cnpj: "98.765.432/0001-10" }].map(c => (
            <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{c.cnpj}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => toast("Solicitação de desvínculo enviada", "info")}>Desvincular</Button>
            </div>
          ))}
        </Card>
      )}

      {tab === "danger" && (
        <Card className="p-5 border-destructive/30 bg-destructive/5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-display font-bold">Zona de Perigo</p>
          </div>
          <p className="text-sm text-muted-foreground">Todos os seus dados, histórico e agenda serão permanentemente excluídos.</p>
          <InputField label='Digite "EXCLUIR" para confirmar' placeholder="EXCLUIR" value={deleteWord} onChange={setDeleteWord} icon={Trash2} required />
          <Button variant="danger" disabled={deleteWord !== "EXCLUIR"} onClick={() => toast("Conta excluída.", "info")} icon={Trash2}>
            Excluir conta permanentemente
          </Button>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLINIC SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

const mockVets = [
  { name: "Dr. Lucas Ferreira", email: "lucas@pethelp.com", crmv: "CRMV-SP 12345", specialty: "Clínica Geral", status: "active" },
  { name: "Dra. Mariana Costa", email: "mariana@pethelp.com", crmv: "CRMV-SP 67890", specialty: "Dermatologia", status: "active" },
  { name: "Dr. Rafael Souza", email: "rafael@pethelp.com", crmv: "CRMV-RJ 11122", specialty: "Ortopedia", status: "pending" },
];

function ClinicDashboard({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [copied, setCopied] = useState(false);
  const code = "CL-8X4F2K";

  const handleCopy = () => {
    setCopied(true);
    toast("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">Dashboard da Clínica</h1>
        <p className="text-muted-foreground text-sm mt-1">Clínica PetVida · CNPJ 12.345.678/0001-90</p>
      </div>
      <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="font-display font-bold text-foreground">Código de conexão</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Compartilhe este código com veterinários para que eles vinculem sua clínica à agenda deles e você possa gerenciar os horários de forma centralizada.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-card rounded-xl border border-border px-4 py-3 font-mono font-bold text-2xl text-foreground tracking-widest text-center">
            {code}
          </div>
          <button
            onClick={handleCopy}
            className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${copied ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 text-emerald-600" : "bg-card border-border hover:border-primary/40 text-muted-foreground hover:text-primary"}`}
            aria-label="Copiar código"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Veterinários", value: "3", icon: Stethoscope, color: "text-primary bg-primary/10" },
          { label: "Consultas hoje", value: "8", icon: Calendar, color: "text-accent bg-accent/15" },
          { label: "Esta semana", value: "34", icon: ClipboardList, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
          { label: "Avaliação média", value: "4.8★", icon: Star, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-2`}><s.icon className="w-4 h-4" /></div>
            <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>
      <div>
        <SectionTitle>Veterinários ativos hoje</SectionTitle>
        <div className="flex flex-col gap-2">
          {mockVets.filter(v => v.status === "active").map(v => (
            <Card key={v.name} className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{v.name}</p>
                <p className="text-xs text-muted-foreground">{v.crmv} · {v.specialty}</p>
              </div>
              <Badge color="success">Ativo</Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClinicVets({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const handleInvite = () => {
    if (!inviteEmail.includes("@")) { toast("E-mail inválido", "error"); return; }
    toast(`Convite enviado para ${inviteEmail}!`);
    setInviteEmail("");
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Gerenciar Veterinários</h1>
      <Card className="p-5">
        <p className="font-semibold text-foreground mb-3">Convidar novo veterinário</p>
        <div className="flex flex-col gap-3">
          <InputField label="E-mail do veterinário" type="email" placeholder="veterinario@email.com" value={inviteEmail} onChange={setInviteEmail} icon={Mail} required />
          <Button icon={Mail} onClick={handleInvite} className="self-start">Enviar convite</Button>
        </div>
      </Card>
      <div>
        <SectionTitle>Profissionais</SectionTitle>
        <div className="flex flex-col gap-3">
          {mockVets.map(v => (
            <Card key={v.name} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{v.name}</p>
                    <Badge color={v.status === "active" ? "success" : "muted"}>{v.status === "active" ? "Ativo" : "Pendente"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{v.email}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{v.crmv} · {v.specialty}</p>
                </div>
                <button onClick={() => toast("Veterinário removido", "info")} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClinicAgenda({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [selectedVet, setSelectedVet] = useState(mockVets[0].name);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Agenda da Clínica</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {mockVets.filter(v => v.status === "active").map(v => (
          <button key={v.name} onClick={() => setSelectedVet(v.name)} className={`shrink-0 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${selectedVet === v.name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
            {v.name.split(" ").slice(0, 2).join(" ")}
          </button>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-foreground">{selectedVet}</p>
          <Button size="sm" icon={Plus} onClick={() => toast("Horário adicionado!")}>Adicionar horário</Button>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { day: "Segunda e Quarta", time: "08:00 – 12:00", slots: 4 },
            { day: "Terça e Quinta", time: "14:00 – 18:00", slots: 4 },
            { day: "Sábado", time: "08:00 – 12:00", slots: 3 },
          ].map(s => (
            <div key={s.day} className="flex items-center gap-3 p-3 rounded-xl bg-muted">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{s.day}</p>
                <p className="text-xs text-muted-foreground">{s.time} · {s.slots} vagas</p>
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => toast("Horário removido", "info")} className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ClinicConfig({ toast }: { toast: (m: string, t?: ToastType) => void }) {
  const [tab, setTab] = useState<"info" | "lang" | "services" | "danger">("info");
  const [services, setServices] = useState(["Consulta clínica", "Vacinação", "Cirurgia", "Internação", "Banho e tosa"]);
  const [newService, setNewService] = useState("");
  const [fantasia, setFantasia] = useState("Clínica PetVida");
  const [telefone, setTelefone] = useState("(11) 3456-7890");
  const [endereco, setEndereco] = useState("Rua das Palmeiras, 123 — São Paulo, SP");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Configurações da Clínica</h1>
      <div className="flex gap-1 flex-wrap border-b border-border pb-0">
        {([["info", "Informações"], ["lang", "Idioma"], ["services", "Serviços"], ["danger", "Zona de Risco"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <Card className="p-5 flex flex-col gap-4">
          <InputField label="Nome Fantasia" placeholder="Clínica PetVida" value={fantasia} onChange={setFantasia} icon={Building2} required />
          <InputField label="CNPJ" value="12.345.678/0001-90" icon={Shield} readOnly hint="O CNPJ não pode ser alterado após o cadastro." />
          <InputField label="E-mail institucional" type="email" value="contato@petvida.com.br" icon={Mail} readOnly hint="O e-mail não pode ser alterado. Entre em contato com o suporte se necessário." />
          <InputField label="Telefone" placeholder="(11) 3456-7890" value={telefone} onChange={setTelefone} icon={Phone} required />
          <InputField label="Endereço" placeholder="Rua, número, cidade, estado" value={endereco} onChange={setEndereco} icon={MapPin} required />
          <Button onClick={() => toast("Dados atualizados!")} className="self-start">Salvar alterações</Button>
        </Card>
      )}

      {tab === "lang" && <LanguageTab />}

      {tab === "services" && (
        <Card className="p-5 flex flex-col gap-4">
          <p className="font-semibold text-foreground">Catálogo de Serviços</p>
          <div className="flex flex-col gap-2">
            {services.map(s => (
              <div key={s} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1 text-sm text-foreground">{s}</span>
                <button onClick={() => setServices(p => p.filter(x => x !== s))} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-input-background rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Novo serviço..."
              value={newService}
              onChange={e => setNewService(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newService) { setServices(p => [...p, newService]); setNewService(""); } }}
            />
            <Button size="sm" variant="secondary" onClick={() => { if (newService) { setServices(p => [...p, newService]); setNewService(""); toast("Serviço adicionado!"); } }}>Adicionar</Button>
          </div>
        </Card>
      )}

      {tab === "danger" && (
        <Card className="p-5 border-destructive/50 bg-destructive/5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-display font-bold text-lg">Zona de Risco</p>
          </div>
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-semibold mb-1">⚠ Atenção</p>
            <p className="text-sm text-muted-foreground">Desativar a conta encerrará todos os vínculos com veterinários, cancelará consultas agendadas e tornará o perfil invisível para tutores.</p>
          </div>
          <Button variant="danger" icon={Zap} onClick={() => toast("Conta desativada. Entre em contato com o suporte para reativar.", "warning")}>
            Desativar conta da clínica
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => toast("Solicitação de exclusão enviada.", "info")}>
            Solicitar exclusão permanente
          </Button>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [role, setRole] = useState<"tutor" | "vet" | "clinic" | null>(null);
  const [screen, setScreen] = useState("home");
  const [darkMode, setDarkMode] = useState(false);
  const { toasts, show: toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const handleReadNotif = (id: string) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const handleReadAllNotifs = () => {
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    toast("Todas as notificações marcadas como lidas");
  };

  const tutorTabs = [
    { id: "home", label: "Início", icon: Home },
    { id: "prontuario", label: "Prontuário", icon: ClipboardList },
    { id: "vacinas", label: "Vacinas", icon: Syringe },
    { id: "exames", label: "Exames", icon: FileText },
    { id: "agendamentos", label: "Agenda", icon: Calendar },
    { id: "config", label: "Config.", icon: Settings },
  ];
  const vetTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "agenda", label: "Agenda", icon: Calendar },
    { id: "config", label: "Config.", icon: Settings },
  ];
  const clinicTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "vets", label: "Veterinários", icon: Stethoscope },
    { id: "agenda", label: "Agenda", icon: Calendar },
    { id: "config", label: "Config.", icon: Settings },
  ];

  const tabs = role === "tutor" ? tutorTabs : role === "vet" ? vetTabs : clinicTabs;
  const userName = role === "tutor" ? "Ana Souza" : role === "vet" ? "Dr. Lucas Ferreira" : "Clínica PetVida";
  const showWhatsApp = role === "vet" || role === "clinic";

  const handleOpenSettings = () => {
    setScreen("config");
    toast("Configurações abertas");
  };

  if (!role) {
    return (
      <>
        <AuthScreen onLogin={r => { setRole(r); setScreen("home"); }} toast={toast} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  const renderScreen = () => {
    if (role === "tutor") {
      if (screen === "home") return <TutorDashboard onScreenChange={setScreen} />;
      if (screen === "prontuario") return <TutorProntuario />;
      if (screen === "vacinas") return <TutorVacinas />;
      if (screen === "exames") return <TutorExames toast={toast} />;
      if (screen === "agendamentos") return <TutorAgendamentos toast={toast} />;
      if (screen === "config") return <TutorConfig toast={toast} />;
    }
    if (role === "vet") {
      if (screen === "home") return <VetDashboard toast={toast} />;
      if (screen === "agenda") return <VetAgenda toast={toast} />;
      if (screen === "config") return <VetConfig toast={toast} />;
    }
    if (role === "clinic") {
      if (screen === "home") return <ClinicDashboard toast={toast} />;
      if (screen === "vets") return <ClinicVets toast={toast} />;
      if (screen === "agenda") return <ClinicAgenda toast={toast} />;
      if (screen === "config") return <ClinicConfig toast={toast} />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)" }}>
      <TopBar
        userName={userName}
        onLogout={() => { setRole(null); setScreen("home"); toast("Sessão encerrada.", "info"); }}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(p => !p)}
        onOpenSettings={handleOpenSettings}
        notifications={notifications}
        onReadNotif={handleReadNotif}
        onReadAllNotifs={handleReadAllNotifs}
      />
      <Sidebar tabs={tabs} active={screen} onChange={setScreen} />
      <NavBar tabs={tabs} active={screen} onChange={setScreen} />
      <Layout>{renderScreen()}</Layout>
      {showWhatsApp && <WhatsAppButton />}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
