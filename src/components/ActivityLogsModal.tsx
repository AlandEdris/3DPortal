import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  PlusCircle,
  Edit3,
  Trash2,
  Tag,
  Search,
  Calendar,
  User,
  Clock,
  Filter,
} from 'lucide-react';
import { ActivityLog } from '../types/model';
import { subscribeToActivityLogs } from '../utils/firebase';

interface ActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeToActivityLogs(
      (newLogs) => {
        setLogs(newLogs);
      },
      (err) => {
        console.warn('Could not load activity logs:', err);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesSearch =
      !searchQuery.trim() ||
      log.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAction && matchesSearch;
  });

  const getActionBadge = (action: ActivityLog['action']) => {
    switch (action) {
      case 'added':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <PlusCircle className="w-3 h-3" />
            Added
          </span>
        );
      case 'renamed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Tag className="w-3 h-3" />
            Renamed
          </span>
        );
      case 'modified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Edit3 className="w-3 h-3" />
            Modified
          </span>
        );
      case 'deleted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Trash2 className="w-3 h-3" />
            Deleted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-300">
            Action
          </span>
        );
    }
  };

  const formatTimestamp = (ts: number) => {
    try {
      const d = new Date(ts);
      return {
        date: d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        time: d.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    } catch {
      return { date: 'Unknown', time: '' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                System Activity & Audit Logs
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                  {logs.length} Total Events
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Real-time tracking of all 3D aircraft additions, modifications, renames, and deletions
              </p>
            </div>
          </div>
          <button
            id="btn-close-activity-logs"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close Activity Logs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-900 flex flex-wrap items-center justify-between gap-3">
          {/* Action Tabs */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            {['all', 'added', 'modified', 'renamed', 'deleted'].map((tab) => (
              <button
                key={tab}
                id={`btn-filter-${tab}`}
                onClick={() => setFilterAction(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                  filterAction === tab
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="input-search-activity-logs"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by model, user, or details..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-sky-500 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Logs Table / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-neutral-500">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30 text-neutral-400" />
              <p className="text-sm font-medium text-neutral-400">No activity logs recorded yet</p>
              <p className="text-xs text-neutral-600 mt-1">
                Any aircraft added, renamed, or deleted will be logged here in real-time.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const { date, time } = formatTimestamp(log.timestamp);
              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="shrink-0">{getActionBadge(log.action)}</div>
                    <div>
                      <div className="font-semibold text-neutral-100 text-sm flex items-center gap-2">
                        <span>{log.modelName}</span>
                      </div>
                      {log.details && (
                        <p className="text-neutral-400 text-xs mt-0.5">{log.details}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-800/50">
                    <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800/80">
                      <User className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-neutral-300 font-medium">{log.userEmail}</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800/80">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{date} at {time}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Synced directly with Firestore audit collection</span>
          <button
            id="btn-footer-close-logs"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
