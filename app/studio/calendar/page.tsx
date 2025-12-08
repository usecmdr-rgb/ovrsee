"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Facebook,
  Music,
  Plus,
  Loader2,
  Edit2,
  Sparkles,
  Repeat,
  MessageSquare,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import RepurposeModal from "@/components/studio/RepurposeModal";

type PostStatus = "draft" | "scheduled" | "publishing" | "posted" | "failed";
type Platform = "instagram" | "tiktok" | "facebook";

interface CalendarPost {
  id: string;
  title: string;
  platform: Platform;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  posted_at: string | null;
  display_date: string;
  account_handle: string | null;
  predicted_score_label?: "low" | "medium" | "high";
  predicted_score_numeric?: number;
  experiment_id?: string | null;
  experiment_variant_label?: string | null;
}

const PLATFORM_ICONS = {
  instagram: Instagram,
  tiktok: Music,
  facebook: Facebook,
};

const PLATFORM_COLORS = {
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
  tiktok: "bg-black",
  facebook: "bg-blue-600",
};

const STATUS_COLORS = {
  draft: "border-slate-300 bg-slate-50 dark:bg-slate-800",
  scheduled: "border-blue-300 bg-blue-50 dark:bg-blue-900/20",
  publishing: "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20",
  posted: "border-green-300 bg-green-50 dark:bg-green-900/20",
  failed: "border-red-300 bg-red-50 dark:bg-red-900/20",
};

export default function StudioCalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [repurposeModalOpen, setRepurposeModalOpen] = useState(false);
  const [selectedPostForRepurpose, setSelectedPostForRepurpose] = useState<{ id: string; platform: Platform } | null>(null);

  // Calculate month range
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Fetch posts for current month
  useEffect(() => {
    loadPosts();
  }, [currentDate]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const fromDate = calendarStart.toISOString();
      const toDate = calendarEnd.toISOString();

      const res = await fetch(
        `/api/studio/calendar?from=${fromDate}&to=${toDate}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to load posts");
      }

      const data = await res.json();
      if (data.ok) {
        setPosts(data.data.posts || []);
      }
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, CalendarPost[]> = {};
    posts.forEach((post) => {
      const dateKey = format(new Date(post.display_date), "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(post);
    });
    return grouped;
  }, [posts]);

  // Get posts for a specific date
  const getPostsForDate = (date: Date): CalendarPost[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    return postsByDate[dateKey] || [];
  };

  // Handle drag start
  const handleDragStart = (postId: string) => {
    setDraggedPost(postId);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle drop
  const handleDrop = async (date: Date) => {
    if (!draggedPost) return;

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      // Set time to noon for the scheduled date
      const scheduledDate = new Date(date);
      scheduledDate.setHours(12, 0, 0, 0);

      const res = await fetch(`/api/studio/posts/${draggedPost}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scheduled_for: scheduledDate.toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to reschedule post");
      }

      // Reload posts
      await loadPosts();
    } catch (error) {
      console.error("Error rescheduling post:", error);
      alert("Failed to reschedule post. Please try again.");
    } finally {
      setDraggedPost(null);
    }
  };

  // Handle create new post
  const handleCreatePost = (date: Date) => {
    const scheduledDate = new Date(date);
    scheduledDate.setHours(12, 0, 0, 0);
    
    // Navigate to Studio main page with scheduled date
    router.push(`/studio?scheduled_for=${scheduledDate.toISOString()}`);
  };

  // Handle generate weekly plan
  const handleGenerateWeeklyPlan = async () => {
    try {
      setGeneratingPlan(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      // Calculate next Monday
      const today = new Date();
      const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
      // If today is Monday or later this week, use next Monday
      const nextMonday = today >= thisWeekMonday
        ? addWeeks(thisWeekMonday, 1)
        : thisWeekMonday;

      const res = await fetch("/api/studio/plans/weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          week_start: nextMonday.toISOString(),
          avoid_duplicates: true,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate weekly plan");
      }

      const data = await res.json();
      if (data.ok) {
        // Reload posts to show new drafts
        await loadPosts();
        
        // Focus calendar on the planned week
        setCurrentDate(nextMonday);
        
        // Show success message
        alert(`Weekly plan generated! Created ${data.data.created_post_ids?.length || 0} draft posts.`);
      }
    } catch (error: any) {
      console.error("Error generating weekly plan:", error);
      alert(error.message || "Failed to generate weekly plan");
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Handle edit post
  const handleEditPost = (postId: string) => {
    router.push(`/studio?postId=${postId}`);
  };

  // Handle repurpose post
  const handleRepurposePost = (e: React.MouseEvent, post: CalendarPost) => {
    e.stopPropagation();
    setSelectedPostForRepurpose({ id: post.id, platform: post.platform });
    setRepurposeModalOpen(true);
  };

  // Handle repurpose success
  const handleRepurposeSuccess = (createdPosts: Array<{ id: string; platform: Platform }>) => {
    // Reload posts to show new drafts
    loadPosts();
  };

  // Calendar days
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Content Calendar
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Plan, schedule, and manage your social media content
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleGenerateWeeklyPlan}
            disabled={generatingPlan}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {generatingPlan ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate Weekly Plan
          </button>
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h2 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
            No posts scheduled yet
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Use Studio to generate a weekly plan or create your first post. Studio Agent can help you plan content that matches your brand voice and posting strategy.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleGenerateWeeklyPlan}
              disabled={generatingPlan}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {generatingPlan ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Weekly Plan
            </button>
            <button
              onClick={() => router.push("/studio/chat")}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Ask Studio Agent
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-4 text-center text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayPosts = getPostsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div
                  key={idx}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(day)}
                  className={`
                    group min-h-[120px] border-r border-b border-slate-200 dark:border-slate-700 p-2
                    ${!isCurrentMonth ? "bg-slate-50 dark:bg-slate-900/50 opacity-50" : ""}
                    ${isCurrentDay ? "bg-violet-50 dark:bg-violet-900/20" : ""}
                    ${isSelected ? "ring-2 ring-violet-500" : ""}
                    hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors
                    cursor-pointer
                  `}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`
                        text-sm font-medium
                        ${isCurrentDay ? "text-violet-600 dark:text-violet-400" : "text-slate-700 dark:text-slate-300"}
                        ${!isCurrentMonth ? "text-slate-400" : ""}
                      `}
                    >
                      {format(day, "d")}
                    </span>
                    {isCurrentMonth && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreatePost(day);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Create new post"
                      >
                        <Plus className="w-4 h-4 text-slate-500" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((post) => {
                      const PlatformIcon = PLATFORM_ICONS[post.platform];
                      return (
                        <div
                          key={post.id}
                          draggable
                          onDragStart={() => handleDragStart(post.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPost(post.id);
                          }}
                          className={`
                            group/post flex items-center gap-1 p-1.5 rounded text-xs
                            ${STATUS_COLORS[post.status]}
                            border cursor-move hover:shadow-sm transition-shadow
                          `}
                          title={`${post.platform} - ${post.status} - ${post.title}`}
                        >
                          <PlatformIcon
                            className={`w-3 h-3 ${
                              post.platform === "tiktok"
                                ? "text-white"
                                : "text-white"
                            }`}
                          />
                          <span className="flex-1 truncate text-slate-700 dark:text-slate-300">
                            {post.title}
                          </span>
                          {post.predicted_score_label && (
                            <span
                              className={`w-2 h-2 rounded-full ${
                                post.predicted_score_label === "high"
                                  ? "bg-green-500"
                                  : post.predicted_score_label === "medium"
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              title={`Predicted performance: ${post.predicted_score_label}`}
                            />
                          )}
                          {post.experiment_variant_label && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              title={`Experiment variant: ${post.experiment_variant_label}`}
                            >
                              {post.experiment_variant_label}
                            </span>
                          )}
                          <button
                            onClick={(e) => handleRepurposePost(e, post)}
                            className="opacity-0 group-hover/post:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity"
                            title="Repurpose to other platforms"
                          >
                            <Repeat className="w-3 h-3 text-slate-500" />
                          </button>
                        </div>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 px-1.5">
                        +{dayPosts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700 dark:text-slate-300">Status:</span>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded border ${color}`} />
              <span className="text-slate-600 dark:text-slate-400 capitalize">{status}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700 dark:text-slate-300">Platform:</span>
          {Object.entries(PLATFORM_ICONS).map(([platform, Icon]) => (
            <div key={platform} className="flex items-center gap-1">
              <Icon className="w-4 h-4" />
              <span className="text-slate-600 dark:text-slate-400 capitalize">{platform}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium mb-2">How to use:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Click on an empty date to create a new post</li>
          <li>Drag posts to different dates to reschedule them</li>
          <li>Click on a post to edit it</li>
          <li>Hover over a post and click the repurpose icon to generate platform-specific variants</li>
        </ul>
      </div>

      {/* Repurpose Modal */}
      {selectedPostForRepurpose && (
        <RepurposeModal
          isOpen={repurposeModalOpen}
          onClose={() => {
            setRepurposeModalOpen(false);
            setSelectedPostForRepurpose(null);
          }}
          sourcePostId={selectedPostForRepurpose.id}
          sourcePlatform={selectedPostForRepurpose.platform}
          onSuccess={handleRepurposeSuccess}
        />
      )}
    </div>
  );
}

