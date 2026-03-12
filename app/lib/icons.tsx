import {
  Clock, Play, Eye, Mail, MailPlus, MailOpen,
  GitBranch, Repeat, RefreshCw, Hash, Shield, AlarmClock,
  FileText, Filter, ArrowUpDown, Link, Copy,
  Type, Braces, Calculator, Code2,
  MessageSquare, MessageCircle, Phone, Zap, Bell, Send,
  Globe, Database, Upload, Download, Key, Server,
  Sparkles, Bot, AlignLeft, Wand2, Brain,
  Terminal, Flag, AlertCircle, AlertTriangle,
  Settings, Info, Layers, Folder,
  ArrowLeftRight, RotateCcw, Merge,
  Scan, Binary, Variable, Shuffle,
  StickyNote, FileCode,
  Table, LayoutList, Sigma,
  Network, Rss,
  Search, Replace, Scissors,
  GripVertical, Percent, Equal, ToggleLeft,
  ChevronDown, ChevronRight, Plus, X, Minus,
  BarChart3, PieChart, LineChart,
  Webhook, AtSign, Timer,
  FlipHorizontal, Split, Combine,
  Package, Box, Archive,
  UserCheck, Users, Building,
  CreditCard, ShoppingCart, DollarSign,
  Calendar, MapPin, Image,
  Lock, Unlock, Fingerprint, Cpu,
  ListFilter, SortAsc, SortDesc, Group,
  FolderSearch, FileSearch,
  IterationCcw, Repeat2, RotateCcwSquare,
  LucideIcon,
} from 'lucide-react';

export type IconName = string;

const iconMap: Record<string, LucideIcon> = {
  // Triggers
  Clock, Play, Eye, Mail, MailOpen, Rss, Webhook, AlarmClock, Calendar,
  // Flow control
  GitBranch, Shuffle, Repeat, RefreshCw, Hash, Shield, Zap, IterationCcw,
  RotateCcw, Repeat2, Split, FlipHorizontal,
  // Data
  FileText, Filter, ArrowUpDown, Link, Copy, Table, Database,
  LayoutList, Merge, Combine, FolderSearch, FileSearch, SortAsc, SortDesc,
  Group, ListFilter, Archive, Box, Package,
  // Transform
  Type, Braces, Calculator, Code2, Scan, Binary, Variable,
  Replace, Scissors, Search, Sigma, Percent, Equal,
  // Send
  MailPlus, MessageSquare, MessageCircle, Phone, Bell, Send,
  AtSign, Users, UserCheck,
  // External
  Globe, Upload, Download, Key, Server, Network, Brain,
  // AI
  Sparkles, Bot, Wand2, AlignLeft, Cpu, Fingerprint,
  // Code
  Terminal, FileCode, GripVertical, StickyNote,
  // End
  Flag, AlertCircle, AlertTriangle,
  // Business
  BarChart3, PieChart, LineChart, Building,
  CreditCard, ShoppingCart, DollarSign, MapPin, Image,
  Lock, Unlock,
  // Misc
  Settings, Info, Layers, Folder, Plus, X, Minus,
  ChevronDown, ChevronRight, ToggleLeft,
};

interface NodeIconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function NodeIcon({ name, size = 14, className = '', strokeWidth = 2 }: NodeIconProps) {
  const Icon = iconMap[name];
  if (!Icon) {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold text-[10px] ${className}`}
        style={{ width: size, height: size }}
      >
        {name[0] || '?'}
      </span>
    );
  }
  return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
}

export { iconMap };
export type { LucideIcon };
