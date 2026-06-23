import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, Lock, Globe, Search, Send, Paperclip, Smile,
  MessageSquare, Users, ChevronDown, Plus, MoreHorizontal,
  Edit2, Trash2, Reply, Check, CheckCheck, X, AtSign,
  DollarSign, UserCircle, Download, Phone, Video,
  PhoneOff, MicOff, Mic, VideoOff, Monitor
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useChatSocket, type ChatMessage, type ChatAttachment } from '../../../hooks/use-chat-socket';
import { useAuth } from '../../../context/auth-context';
import { cn } from '../../../lib/utils';
import { useWebRTC } from '../../../hooks/use-webrtc';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatRoomMember {
  id: string;
  userId: string;
  lastReadAt?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    role?: { name: string; description: string };
    employeeProfile?: {
      jobTitle?: string;
      department?: { name: string };
    };
    presence?: {
      isOnline: boolean;
      lastSeen: string;
    };
  };
}

const formatLastSeen = (lastSeenDateStr?: string) => {
  if (!lastSeenDateStr) return 'Hors ligne';
  const lastSeen = new Date(lastSeenDateStr);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'en ligne à l\'instant';
  if (diffMins < 60) return `en ligne il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `en ligne il y a ${diffHours} h`;
  return `en ligne le ${lastSeen.toLocaleDateString()}`;
};

interface ChatRoom {
  id: string;
  name?: string;
  type: 'DIRECT' | 'GROUP' | 'CHANNEL';
  projectId?: string;
  project?: { id: string; name: string };
  members?: ChatRoomMember[];
  messages?: ChatMessage[];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
  'from-sky-500 to-cyan-600',
  'from-violet-500 to-purple-600',
];

export const Avatar: React.FC<{
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  online?: boolean;
  avatarUrl?: string;
}> = ({ name, size = 'md', online, avatarUrl }) => {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const sizeClasses = { xs: 'w-6 h-6 text-[9px]', sm: 'w-8 h-8 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-11 h-11 text-sm' };
  const dotSizes = { xs: 'w-2 h-2', sm: 'w-2.5 h-2.5', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' };
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <div className="relative inline-flex shrink-0">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className={cn('rounded-full object-cover', sizeClasses[size])} />
      ) : (
        <div className={cn('rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white', sizeClasses[size], `bg-gradient-to-br ${color}`)}>
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span className={cn('absolute bottom-0 right-0 rounded-full border-2 border-[#0f1117]', dotSizes[size], online ? 'bg-emerald-400' : 'bg-gray-600')} />
      )}
    </div>
  );
};

// ─── Room helpers ─────────────────────────────────────────────────────────────

const getRoomDisplayType = (room: ChatRoom, userId: string): 'GLOBAL' | 'HR' | 'FINANCE' | 'PROJECT' | 'DIRECT' => {
  if (room.type === 'DIRECT') return 'DIRECT';
  if (room.name === 'HR Team') return 'HR';
  if (room.name === 'Finance Team') return 'FINANCE';
  if (room.projectId) return 'PROJECT';
  return 'GLOBAL';
};

const getRoomIcon = (type: string) => {
  const icons: Record<string, React.ReactNode> = {
    GLOBAL: <Globe size={14} />,
    PROJECT: <Hash size={14} />,
    DIRECT: <Lock size={14} />,
    HR: <UserCircle size={14} />,
    FINANCE: <DollarSign size={14} />,
  };
  return icons[type] || <Hash size={14} />;
};

const getRoomColor = (type: string) => {
  const colors: Record<string, string> = {
    GLOBAL: 'bg-emerald-500/15 text-emerald-400',
    PROJECT: 'bg-indigo-500/15 text-indigo-400',
    DIRECT: 'bg-purple-500/15 text-purple-400',
    HR: 'bg-sky-500/15 text-sky-400',
    FINANCE: 'bg-amber-500/15 text-amber-400',
  };
  return colors[type] || 'bg-indigo-500/15 text-indigo-400';
};

const getRoomDisplayName = (room: ChatRoom, userId: string) => {
  if (room.type === 'DIRECT') {
    const other = room.members?.find((m) => m.userId !== userId);
    if (other) return `${other.user.firstName} ${other.user.lastName}`;
  }
  return room.name ?? 'Canal';
};

// ─── Room Item ─────────────────────────────────────────────────────────────────

const RoomItem: React.FC<{
  room: ChatRoom;
  userId: string;
  isActive: boolean;
  unread?: number;
  lastMessage?: ChatMessage;
  onlineUserIds: string[];
  onClick: () => void;
}> = ({ room, userId, isActive, unread, lastMessage, onlineUserIds, onClick }) => {
  const dtype = getRoomDisplayType(room, userId);
  const name = getRoomDisplayName(room, userId);
  const isOnline = dtype === 'DIRECT' && !!room.members?.find((m) => m.userId !== userId && onlineUserIds.includes(m.userId));

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-150 text-left group',
        isActive ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-white/[0.04] border border-transparent'
      )}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', getRoomColor(dtype))}>
        {dtype === 'DIRECT' ? (
          <Avatar name={name} size="xs" online={isOnline} />
        ) : (
          getRoomIcon(dtype)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={cn('text-sm font-medium truncate', isActive ? 'text-white' : 'text-gray-300 group-hover:text-white')}>
            {name}
          </p>
          {lastMessage && (
            <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-1">
              {new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {lastMessage && (
          <p className="text-[11px] text-muted-foreground/70 truncate">
            {lastMessage.isDeleted ? '🗑 Message supprimé' : lastMessage.content}
          </p>
        )}
      </div>
      {unread && unread > 0 ? (
        <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </button>
  );
};

// ─── Room Group ─────────────────────────────────────────────────────────────────

const RoomGroup: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1.5 w-full text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest hover:text-gray-300 transition-colors py-1 px-1 mb-0.5"
      >
        {icon}
        {label}
        <ChevronDown size={9} className={cn('ml-auto transition-transform', !expanded && '-rotate-90')} />
      </button>
      {expanded && <div className="space-y-0.5">{children}</div>}
    </div>
  );
};

// ─── Message Actions ──────────────────────────────────────────────────────────

const MessageActions: React.FC<{
  isMine: boolean;
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ isMine, onReply, onEdit, onDelete }) => (
  <div className={cn(
    'absolute top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1d2e] border border-white/10 rounded-lg shadow-xl p-1',
    isMine ? 'right-full mr-2' : 'left-full ml-2'
  )}>
    <button onClick={onReply} title="Répondre" className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
      <Reply size={13} />
    </button>
    {isMine && onEdit && (
      <button onClick={onEdit} title="Modifier" className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-indigo-300 transition-colors">
        <Edit2 size={13} />
      </button>
    )}
    {isMine && onDelete && (
      <button onClick={onDelete} title="Supprimer" className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-red-300 transition-colors">
        <Trash2 size={13} />
      </button>
    )}
  </div>
);

// ─── Message Status Icon ──────────────────────────────────────────────────────

const MessageStatusIcon: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'SEEN') return <CheckCheck size={12} className="text-indigo-400" />;
  if (status === 'DELIVERED') return <CheckCheck size={12} className="text-gray-500" />;
  return <Check size={12} className="text-gray-500" />;
};

// ─── Message Bubble ──────────────────────────────────────────────────────────

const MessageBubble: React.FC<{
  message: ChatMessage;
  isMine: boolean;
  prevSenderId?: string;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msgId: string) => void;
}> = ({ message, isMine, prevSenderId, onReply, onEdit, onDelete }) => {
  const isGrouped = prevSenderId === message.senderId;
  const senderName = `${message.sender.firstName} ${message.sender.lastName}`;
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.isDeleted) {
    return (
      <div className={cn('flex gap-2.5 group', isMine && 'flex-row-reverse')}>
        {!isGrouped && !isMine && <div className="w-8 shrink-0" />}
        {isGrouped ? <div className="w-8 shrink-0" /> : (!isMine ? <Avatar name={senderName} size="sm" /> : null)}
        <div className={cn('max-w-[65%]', isMine && 'flex flex-col items-end')}>
          <div className="rounded-2xl px-4 py-2.5 text-sm italic text-muted-foreground/50 bg-white/[0.03] border border-white/[0.04]">
            🗑 Ce message a été supprimé
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={`msg-${message.id}`} className={cn('flex gap-2.5 group relative transition-colors duration-300', isMine && 'flex-row-reverse')}>
      {isGrouped ? <div className="w-8 shrink-0" /> : (!isMine ? <Avatar name={senderName} size="sm" avatarUrl={message.sender.avatarUrl} /> : <div className="w-8 shrink-0" />)}
      <div className={cn('max-w-[65%] space-y-1 relative', isMine && 'items-end flex flex-col')}>
        {!isGrouped && !isMine && (
          <p className="text-[11px] font-semibold text-muted-foreground/80 px-1">{senderName}</p>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div className={cn('text-[11px] px-3 py-1.5 rounded-lg border-l-2 border-indigo-500 bg-indigo-500/10 text-muted-foreground mb-1 max-w-full', isMine && 'mr-1')}>
            <span className="font-semibold text-indigo-300">{message.replyTo.sender.firstName}</span>
            <span className="ml-1 truncate block">{message.replyTo.content.slice(0, 80)}</span>
          </div>
        )}

        {/* Main bubble */}
        <div className="relative">
          <MessageActions
            isMine={isMine}
            onReply={() => onReply(message)}
            onEdit={isMine ? () => onEdit(message) : undefined}
            onDelete={isMine ? () => onDelete(message.id) : undefined}
          />
          <div className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isMine
              ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm'
              : 'bg-white/[0.06] text-gray-100 border border-white/[0.06] rounded-bl-sm'
          )}>
            {message.content}
            {message.isEdited && <span className="text-[9px] opacity-50 ml-1">(modifié)</span>}

            {/* Render Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.attachments.map((attach, idx) => {
                  const isImage = attach.type?.startsWith('image/');
                  if (isImage) {
                    return (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-white/10 max-w-sm mt-1">
                        <a href={attach.url} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={attach.url}
                            alt={attach.name}
                            className="max-h-60 object-cover rounded-lg w-full transition-transform duration-200 hover:scale-105"
                          />
                        </a>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 max-w-xs mt-1">
                      <Paperclip size={18} className="text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{attach.name}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {(attach.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <a
                        href={attach.url}
                        download={attach.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-lg hover:bg-white/10 text-indigo-400 hover:text-indigo-300 transition-colors"
                        title="Télécharger"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={cn('flex items-center gap-1 px-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
          <p className="text-[10px] text-muted-foreground/50">{time}</p>
          {isMine && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
};

// ─── Date Divider ─────────────────────────────────────────────────────────────

const DateDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 py-3">
    <div className="flex-1 h-px bg-white/[0.04]" />
    <span className="text-[10px] text-muted-foreground/60 font-medium px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.04]">
      {label}
    </span>
    <div className="flex-1 h-px bg-white/[0.04]" />
  </div>
);

// ─── Typing Indicator ─────────────────────────────────────────────────────────

const TypingIndicator: React.FC<{ typingNames: string[] }> = ({ typingNames }) => {
  if (typingNames.length === 0) return null;
  const text = typingNames.length === 1
    ? `${typingNames[0]} est en train d'écrire…`
    : `${typingNames.slice(0, -1).join(', ')} et ${typingNames.slice(-1)} sont en train d'écrire…`;

  return (
    <div className="flex items-center gap-2 px-5 py-2 text-xs text-muted-foreground/70">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span>{text}</span>
    </div>
  );
};
// ─── New Conversation Dialog ──────────────────────────────────────────────────

const NewConversationDialog: React.FC<{
  allUsers: { id: string; firstName: string; lastName: string; email: string }[];
  currentUserId: string;
  onSelectUser: (userId: string) => void;
  onCreateGroup: (name: string, userIds: string[]) => void;
  onClose: () => void;
}> = ({ allUsers, currentUserId, onSelectUser, onCreateGroup, onClose }) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'group'>('direct');
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const filtered = allUsers.filter(u => u.id !== currentUserId && (
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  ));

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (groupName.trim() && selectedUserIds.length > 0) {
      onCreateGroup(groupName.trim(), selectedUserIds);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[450px] bg-[#16192a] border border-white/10 rounded-2xl shadow-2xl p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-base">Nouvelle Discussion</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-white/5 mb-4">
          <button
            onClick={() => { setActiveTab('direct'); setSearch(''); }}
            className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'direct' ? 'text-indigo-400 border-indigo-500' : 'text-muted-foreground border-transparent hover:text-gray-300'
            }`}
          >
            Message Direct
          </button>
          <button
            onClick={() => { setActiveTab('group'); setSearch(''); }}
            className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'group' ? 'text-indigo-400 border-indigo-500' : 'text-muted-foreground border-transparent hover:text-gray-300'
            }`}
          >
            Discussion de Groupe
          </button>
        </div>

        {/* Direct Tab Content */}
        {activeTab === 'direct' && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher des utilisateurs par nom ou email..."
                className="glass-input w-full pl-9 pr-4 py-2 text-sm"
              />
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => onSelectUser(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left transition-colors"
                >
                  <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-white">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-6">Aucun utilisateur trouvé</p>
              )}
            </div>
          </div>
        )}

        {/* Group Tab Content */}
        {activeTab === 'group' && (
          <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nom de la discussion</label>
              <input
                autoFocus
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Ex: Team Design, Lancement Campagne..."
                className="glass-input w-full px-3 py-2 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sélectionner des membres</label>
                {selectedUserIds.length > 0 && (
                  <span className="text-[10px] text-indigo-400 font-semibold">{selectedUserIds.length} sélectionné(s)</span>
                )}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filtrer les utilisateurs..."
                  className="glass-input w-full pl-9 pr-4 py-1.5 text-xs"
                />
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto border border-white/5 rounded-xl p-2 bg-white/[0.01]">
                {filtered.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={`${u.firstName} ${u.lastName}`} size="xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-white/10 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 bg-transparent"
                      />
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">Aucun utilisateur disponible</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2 px-4 rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!groupName.trim() || selectedUserIds.length === 0}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/5 disabled:text-muted-foreground text-white font-semibold text-xs py-2 px-4 rounded-xl transition-all disabled:opacity-50"
              >
                Créer la discussion
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch rooms
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<ChatRoom[]>({
    queryKey: ['chat-rooms'],
    queryFn: async () => {
      const res = await api.get<ChatRoom[]>('/chat/rooms');
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Fetch messages for active room
  const { data: initialMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', activeRoomId],
    queryFn: async () => {
      const res = await api.get<ChatMessage[]>(`/chat/rooms/${activeRoomId}/messages`);
      return res.data;
    },
    enabled: !!activeRoomId,
  });

  // Fetch all users for DM
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-for-chat'],
    queryFn: async () => {
      const res = await api.get<{ data: any[] }>('/users');
      return res.data.data ?? [];
    },
  });

  // Fetch unread counts
  const { data: unreadCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['chat-unread'],
    queryFn: async () => {
      const res = await api.get<Record<string, number>>('/chat/unread-counts');
      return res.data;
    },
    refetchInterval: 15000,
  });

  const {
    messages, isChatConnected, onlineUserIds, typingUsers,
    sendMessage, editMessage, deleteMessage, handleTyping, markRead, loadMessages,
    socketRef,
  } = useChatSocket(activeRoomId);

  const {
    callState, incomingCall, isVideo, isMuted, isCameraOff, isScreenSharing,
    localVideoRef, remoteVideoRef,
    startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, toggleScreenShare,
  } = useWebRTC(socketRef, user?.id ?? '', user ? `${user.firstName} ${user.lastName}` : '');

  useEffect(() => {
    if (initialMessages.length > 0) loadMessages(initialMessages);
  }, [initialMessages, loadMessages]);

  useEffect(() => {
    if (rooms.length > 0 && !activeRoomId) {
      const globalRoom = rooms.find(r => r.name === 'Global Chat');
      setActiveRoomId(globalRoom?.id ?? rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeRoomId) markRead();
  }, [activeRoomId, markRead]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if ((!trimmed && attachedFiles.length === 0) || !activeRoomId) return;

    if (editingMessage) {
      editMessage(editingMessage.id, trimmed);
      setEditingMessage(null);
    } else {
      sendMessage(trimmed, {
        replyToId: replyTo?.id,
        attachments: attachedFiles,
      });
      setReplyTo(null);
      setAttachedFiles([]);
    }
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, activeRoomId, editingMessage, replyTo, sendMessage, editMessage, attachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') { setReplyTo(null); setEditingMessage(null); }
    handleTyping();
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setReplyTo(null);
    setInputValue(msg.content);
    inputRef.current?.focus();
  };

  const handleDeleteMessage = async (msgId: string) => {
    deleteMessage(msgId);
  };

  const handleNewDm = async (targetUserId: string) => {
    setShowNewDm(false);
    try {
      const res = await api.post<ChatRoom>('/chat/rooms', { type: 'DIRECT', userIds: [targetUserId] });
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      setActiveRoomId(res.data.id);
    } catch {}
  };

  const handleCreateGroup = async (name: string, targetUserIds: string[]) => {
    setShowNewDm(false);
    try {
      const res = await api.post<ChatRoom>('/chat/rooms', { name, type: 'GROUP', userIds: targetUserIds });
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      setActiveRoomId(res.data.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: ChatAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await api.post('/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const uploaded = response.data;
        newAttachments.push({
          url: uploaded.url,
          name: uploaded.name,
          size: uploaded.size,
          type: uploaded.mimeType,
        });
      } catch (err) {
        console.error('Error uploading file:', err);
      }
    }

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    setIsUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const activeRoomType = activeRoom ? getRoomDisplayType(activeRoom, user?.id ?? '') : 'GLOBAL';
  const activeRoomName = activeRoom ? getRoomDisplayName(activeRoom, user?.id ?? '') : '';

  // Filter and group rooms
  const filteredRooms = rooms.filter((r) =>
    getRoomDisplayName(r, user?.id ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const globalRooms = filteredRooms.filter(r => {
    const t = getRoomDisplayType(r, user?.id ?? '');
    return t === 'GLOBAL';
  });
  const hrRooms = filteredRooms.filter(r => getRoomDisplayType(r, user?.id ?? '') === 'HR');
  const financeRooms = filteredRooms.filter(r => getRoomDisplayType(r, user?.id ?? '') === 'FINANCE');
  const projectRooms = filteredRooms.filter(r => getRoomDisplayType(r, user?.id ?? '') === 'PROJECT');
  const directRooms = filteredRooms.filter(r => getRoomDisplayType(r, user?.id ?? '') === 'DIRECT');

  // Filter users
  const filteredUsers = allUsers.filter((u: any) =>
    u.id !== user?.id && (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Filter messages in the current/loaded chat
  const filteredMessages = messages.filter((m) =>
    !m.isDeleted && m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter attachments/files in the current chat
  const filteredFiles = messages.flatMap(m => m.attachments || []).filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; messages: ChatMessage[] }[]>((groups, msg) => {
    const d = new Date(msg.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (d.toDateString() === today.toDateString()) label = "Aujourd'hui";
    else if (d.toDateString() === yesterday.toDateString()) label = "Hier";
    else label = d.toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' });

    const last = groups[groups.length - 1];
    if (last && last.date === label) { last.messages.push(msg); }
    else { groups.push({ date: label, messages: [msg] }); }
    return groups;
  }, []);

  // Typing users in current room
  const typingNames = Object.entries(typingUsers)
    .filter(([uid, isTyping]) => isTyping && uid !== user?.id)
    .map(([uid]) => {
      const member = activeRoom?.members?.find(m => m.userId === uid);
      return member ? member.user.firstName : null;
    })
    .filter(Boolean) as string[];

  const canSend = isChatConnected && (inputValue.trim() || attachedFiles.length > 0) && !isUploading;

  return (
    <>
      {/* Incoming Call Dialog */}
      {incomingCall && callState === 'ringing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
          <div className="bg-[#16192a] border border-white/10 rounded-2xl shadow-2xl p-6 w-[360px] text-center space-y-6 animate-scale-in">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xl animate-pulse">
                {incomingCall.callerName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{incomingCall.callerName}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Appel {incomingCall.isVideo ? 'vidéo' : 'audio'} entrant...
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={rejectCall}
                className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-rose-500/20"
                title="Décliner"
              >
                <PhoneOff size={18} />
              </button>
              <button
                onClick={acceptCall}
                className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
                title="Accepter"
              >
                {incomingCall.isVideo ? <Video size={18} /> : <Phone size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Overlay */}
      {callState !== 'idle' && callState !== 'ringing' && (
        <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-lg flex flex-col justify-between p-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <h3 className="font-bold text-sm">Appel en cours</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {callState === 'calling' ? 'Appel de...' : 'Connecté'}
              </p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center my-6 gap-6 min-h-0 relative">
            {/* Remote Video */}
            <div className="relative flex-1 max-w-4xl h-full bg-white/5 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
              {isVideo ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Phone size={36} className="animate-pulse" />
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-xs text-white">
                Correspondant
              </div>
            </div>

            {/* Local Video (picture-in-picture) */}
            {isVideo && (
              <div className="w-64 h-48 bg-black border border-white/15 rounded-2xl overflow-hidden absolute top-4 right-4 shadow-2xl z-50">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
                  Vous {isMuted && '(Muet)'}
                </div>
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleMute}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              )}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {isVideo && (
              <button
                onClick={toggleCamera}
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                  isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                )}
              >
                {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
            )}

            {isVideo && (
              <button
                onClick={toggleScreenShare}
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                  isScreenSharing ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                )}
              >
                <Monitor size={18} />
              </button>
            )}

            <button
              onClick={endCall}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/20"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </div>
      )}

      {showNewDm && (
        <NewConversationDialog
          allUsers={allUsers}
          currentUserId={user?.id ?? ''}
          onSelectUser={handleNewDm}
          onCreateGroup={handleCreateGroup}
          onClose={() => setShowNewDm(false)}
        />
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
      />

      <div className="h-[calc(100vh-7rem)] flex -m-6 overflow-hidden bg-[#0f1117]">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-white/[0.05] bg-white/[0.008]">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.05] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Espace de travail</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('w-1.5 h-1.5 rounded-full', isChatConnected ? 'bg-emerald-400' : 'bg-gray-600')} />
              <span className="text-[9px] text-muted-foreground">{isChatConnected ? 'En ligne' : 'Hors ligne'}</span>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher canaux, membres, messages..."
                className="glass-input w-full pl-8 pr-3 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Room / Search Results List */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
            {roomsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />)
            ) : searchQuery ? (
              <div className="space-y-4">
                {/* Channels */}
                {filteredRooms.length > 0 && (
                  <RoomGroup label="Canaux & Groupes" icon={<Hash size={10} />}>
                    {filteredRooms.map(room => (
                      <RoomItem key={room.id} room={room} userId={user?.id ?? ''} isActive={room.id === activeRoomId}
                        unread={unreadCounts[room.id]} lastMessage={room.messages?.[0]} onlineUserIds={onlineUserIds}
                        onClick={() => { setActiveRoomId(room.id); setSearchQuery(''); }} />
                    ))}
                  </RoomGroup>
                )}

                {/* Users */}
                {filteredUsers.length > 0 && (
                  <RoomGroup label="Membres" icon={<Users size={10} />}>
                    {filteredUsers.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => { handleNewDm(u.id); setSearchQuery(''); }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group"
                      >
                        <Avatar name={`${u.firstName} ${u.lastName}`} size="xs" online={onlineUserIds.includes(u.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-[10px] text-muted-foreground/60 truncate">
                            {u.employeeProfile?.jobTitle || u.role?.description || 'Membre'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </RoomGroup>
                )}

                {/* Messages */}
                {filteredMessages.length > 0 && (
                  <RoomGroup label="Messages" icon={<MessageSquare size={10} />}>
                    {filteredMessages.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          const el = document.getElementById(`msg-${m.id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el?.classList.add('bg-indigo-500/20');
                          setTimeout(() => el?.classList.remove('bg-indigo-500/20'), 2000);
                        }}
                        className="w-full flex flex-col gap-0.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-all text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-indigo-400">{m.sender.firstName} {m.sender.lastName}</span>
                          <span className="text-[9px] text-muted-foreground/50">{new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <p className="text-[11px] text-gray-300 truncate">{m.content}</p>
                      </button>
                    ))}
                  </RoomGroup>
                )}

                {/* Files */}
                {filteredFiles.length > 0 && (
                  <RoomGroup label="Fichiers" icon={<Paperclip size={10} />}>
                    {filteredFiles.map((a, idx) => (
                      <a
                        key={idx}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group"
                      >
                        <Paperclip size={12} className="text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-white truncate">{a.name}</p>
                          <p className="text-[9px] text-muted-foreground/60">{(a.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </a>
                    ))}
                  </RoomGroup>
                )}

                {filteredRooms.length === 0 && filteredUsers.length === 0 && filteredMessages.length === 0 && filteredFiles.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">Aucun résultat</p>
                )}
              </div>
            ) : (
              <>
                {globalRooms.length > 0 && (
                  <RoomGroup label="Entreprise" icon={<Globe size={10} />}>
                    {globalRooms.map(room => (
                      <RoomItem key={room.id} room={room} userId={user?.id ?? ''} isActive={room.id === activeRoomId}
                        unread={unreadCounts[room.id]} lastMessage={room.messages?.[0]} onlineUserIds={onlineUserIds}
                        onClick={() => setActiveRoomId(room.id)} />
                    ))}
                  </RoomGroup>
                )}
                {hrRooms.length > 0 && (
                  <RoomGroup label="RH" icon={<UserCircle size={10} />}>
                    {hrRooms.map(room => (
                      <RoomItem key={room.id} room={room} userId={user?.id ?? ''} isActive={room.id === activeRoomId}
                        unread={unreadCounts[room.id]} lastMessage={room.messages?.[0]} onlineUserIds={onlineUserIds}
                        onClick={() => setActiveRoomId(room.id)} />
                    ))}
                  </RoomGroup>
                )}
                {financeRooms.length > 0 && (
                  <RoomGroup label="Finance" icon={<DollarSign size={10} />}>
                    {financeRooms.map(room => (
                      <RoomItem key={room.id} room={room} userId={user?.id ?? ''} isActive={room.id === activeRoomId}
                        unread={unreadCounts[room.id]} lastMessage={room.messages?.[0]} onlineUserIds={onlineUserIds}
                        onClick={() => setActiveRoomId(room.id)} />
                    ))}
                  </RoomGroup>
                )}
                {projectRooms.length > 0 && (
                  <RoomGroup label="Projets" icon={<Hash size={10} />}>
                    {projectRooms.map(room => (
                      <RoomItem key={room.id} room={room} userId={user?.id ?? ''} isActive={room.id === activeRoomId}
                        unread={unreadCounts[room.id]} lastMessage={room.messages?.[0]} onlineUserIds={onlineUserIds}
                        onClick={() => setActiveRoomId(room.id)} />
                    ))}
                  </RoomGroup>
                )}
                {directRooms.length > 0 && (
                  <RoomGroup label="Messages Directs" icon={<Lock size={10} />}>
                    {directRooms.map(room => (
                      <RoomItem key={room.id} room={room} userId={user?.id ?? ''} isActive={room.id === activeRoomId}
                        unread={unreadCounts[room.id]} lastMessage={room.messages?.[0]} onlineUserIds={onlineUserIds}
                        onClick={() => setActiveRoomId(room.id)} />
                    ))}
                  </RoomGroup>
                )}
              </>
            )}
          </div>

          {/* New Discussion Button */}
          <div className="px-3 py-3 border-t border-white/[0.05] shrink-0">
            <button
              onClick={() => setShowNewDm(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.05] text-muted-foreground hover:text-white transition-all text-xs font-medium"
            >
              <Plus size={13} />
              Nouvelle Discussion
            </button>
          </div>
        </aside>

        {/* ── Chat Panel ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeRoom ? (
            <>
              {/* Chat Header */}
              <div className="h-14 flex items-center justify-between px-5 border-b border-white/[0.05] shrink-0 bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', getRoomColor(activeRoomType))}>
                    {activeRoomType === 'DIRECT' ? (
                      <Avatar name={activeRoomName} size="xs"
                        online={!!activeRoom.members?.find(m => m.userId !== user?.id && onlineUserIds.includes(m.userId))}
                      />
                    ) : getRoomIcon(activeRoomType)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {activeRoomName}
                      {activeRoomType === 'DIRECT' && (
                        <span className="text-[10px] font-normal text-muted-foreground/80 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          {(() => {
                            const other = activeRoom.members?.find(m => m.userId !== user?.id);
                            const role = other?.user.role?.description || other?.user.role?.name;
                            const dept = other?.user.employeeProfile?.department?.name || other?.user.employeeProfile?.jobTitle;
                            return dept ? `${role} · ${dept}` : role || 'Membre';
                          })()}
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      {activeRoomType === 'DIRECT' ? (
                        (() => {
                          const other = activeRoom.members?.find(m => m.userId !== user?.id);
                          const isOnline = other && onlineUserIds.includes(other.userId);
                          return (
                            <>
                              <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-gray-500')} />
                              <span>{isOnline ? 'En ligne' : formatLastSeen(other?.user.presence?.lastSeen)}</span>
                            </>
                          );
                        })()
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>{messages.length} messages · {activeRoom.members?.length ?? 0} membres</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Message search input inside header */}
                  <div className="relative hidden md:block">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher dans la discussion..."
                      className="glass-input w-44 pl-8 pr-3 py-1 text-[11px]"
                    />
                  </div>

                  <button
                    onClick={() => activeRoomId && startCall(activeRoomId, false)}
                    className="p-2 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Appel audio"
                    disabled={callState !== 'idle'}
                  >
                    <Phone size={15} />
                  </button>

                  <button
                    onClick={() => activeRoomId && startCall(activeRoomId, true)}
                    className="p-2 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    title="Appel vidéo"
                    disabled={callState !== 'idle'}
                  >
                    <Video size={15} />
                  </button>

                  <button onClick={() => setShowMemberPanel(p => !p)}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Membres">
                    <Users size={15} />
                  </button>

                  <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 min-h-0">
                {/* Messages Area */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                        <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center', getRoomColor(activeRoomType))}>
                          {getRoomIcon(activeRoomType)}
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-white">Commencez la conversation</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Soyez le premier à envoyer un message dans {activeRoomName} !
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {groupedMessages.map((group) => (
                          <div key={group.date}>
                            <DateDivider label={group.date} />
                            <div className="space-y-1 py-1">
                              {group.messages.map((msg, idx) => (
                                <MessageBubble
                                  key={msg.id}
                                  message={msg}
                                  isMine={msg.senderId === user?.id}
                                  prevSenderId={idx > 0 ? group.messages[idx - 1].senderId : undefined}
                                  onReply={setReplyTo}
                                  onEdit={handleStartEdit}
                                  onDelete={handleDeleteMessage}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Typing Indicator */}
                  <TypingIndicator typingNames={typingNames} />

                  {/* Reply/Edit Preview */}
                  {(replyTo || editingMessage) && (
                    <div className="mx-5 mb-1 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {replyTo ? (
                          <>
                            <Reply size={12} className="text-indigo-400 shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">
                              <span className="text-indigo-300 font-semibold">{replyTo.sender.firstName}</span>: {replyTo.content.slice(0, 60)}
                            </p>
                          </>
                        ) : (
                          <>
                            <Edit2 size={12} className="text-amber-400 shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">
                              <span className="text-amber-300 font-semibold">Modification</span>: {editingMessage?.content.slice(0, 60)}
                            </p>
                          </>
                        )}
                      </div>
                      <button onClick={() => { setReplyTo(null); setEditingMessage(null); setInputValue(''); }}>
                        <X size={13} className="text-muted-foreground hover:text-white" />
                      </button>
                    </div>
                  )}

                  {/* Input */}
                  <div className="px-5 py-4 border-t border-white/[0.05] shrink-0">
                    {/* File Attachment Previews */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2.5">
                        {attachedFiles.map((file, idx) => (
                          <div key={idx} className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white max-w-[200px] group">
                            <span className="truncate flex-1">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-gray-400 hover:text-red-400 shrink-0"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {isUploading && (
                      <div className="text-xs text-indigo-400 mb-2 px-1 flex items-center gap-2 animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                        Téléchargement des fichiers...
                      </div>
                    )}

                    <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-2.5 focus-within:border-indigo-500/40 transition-colors">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 disabled:opacity-50"
                        title="Joindre un fichier"
                      >
                        <Paperclip size={16} />
                      </button>
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => { setInputValue(e.target.value); handleTyping(); }}
                        onKeyDown={handleKeyDown}
                        placeholder={editingMessage ? 'Modifier le message...' : `Message dans ${activeRoomName}...`}
                        className="flex-1 bg-transparent text-sm text-white placeholder-muted-foreground/50 outline-none"
                      />
                      <button className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                        <Smile size={16} />
                      </button>
                      <button className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                        <AtSign size={16} />
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={!canSend}
                        className={cn(
                          'w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0',
                          canSend
                            ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/30'
                            : 'bg-white/[0.04] text-muted-foreground cursor-not-allowed'
                        )}
                      >
                        <Send size={13} />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-1">
                      <kbd className="px-1 py-0.5 bg-white/5 rounded text-[9px] border border-white/10">Entrée</kbd> pour envoyer &nbsp;·&nbsp;
                      <kbd className="px-1 py-0.5 bg-white/5 rounded text-[9px] border border-white/10">Échap</kbd> pour annuler
                    </p>
                  </div>
                </div>

                {/* Members Panel */}
                {showMemberPanel && activeRoom.members && (
                  <aside className="w-64 border-l border-white/[0.05] bg-white/[0.008] flex flex-col overflow-hidden">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.05]">
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Users size={13} className="text-indigo-400" /> Membres ({activeRoom.members.length})
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                      {activeRoom.members.map((m) => {
                        const isOnline = onlineUserIds.includes(m.userId);
                        return (
                          <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                            <Avatar name={`${m.user.firstName} ${m.user.lastName}`} size="sm" online={isOnline} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">{m.user.firstName} {m.user.lastName}</p>
                              <p className={cn('text-[10px]', isOnline ? 'text-emerald-400' : 'text-muted-foreground/60')}>
                                {isOnline ? 'En ligne' : 'Hors ligne'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </aside>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                <MessageSquare size={36} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Sélectionnez un canal</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Choisissez un canal dans la barre latérale pour commencer à envoyer des messages à votre équipe.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
