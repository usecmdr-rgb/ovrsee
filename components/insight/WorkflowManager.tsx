"use client";

import { useState, useEffect, useCallback } from "react";
import { Workflow, Zap, Plus, Trash2, Edit2, Play, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import type { Workflow as WorkflowType, WorkflowTrigger, WorkflowCondition } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";

export default function WorkflowManager() {
  const t = useTranslation();
  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowType | null>(null);
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);

  // Mock userId - in production, get from auth context
  const userId = "user-1";

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/insight/workflows?userId=${userId}`);
      const result = await response.json();

      if (result.ok) {
        setWorkflows(result.data || []);
      } else {
        setError(result.error || t("workflowFailedToFetch"));
      }
    } catch (err: any) {
      setError(err.message || t("workflowFailedToFetch"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const createWorkflow = async (workflow: Omit<WorkflowType, "id" | "createdAt" | "updatedAt">) => {
    try {
      const response = await fetch("/api/insight/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...workflow, userId }),
      });

      const result = await response.json();

      if (result.ok) {
        await fetchWorkflows();
        setShowCreateForm(false);
        return true;
      } else {
        setError(result.error || t("workflowFailedToCreate"));
        return false;
      }
    } catch (err: any) {
      setError(err.message || t("workflowFailedToCreate"));
      return false;
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm(t("workflowConfirmDelete"))) return;

    try {
      const response = await fetch(`/api/insight/workflows/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.ok) {
        await fetchWorkflows();
      } else {
        setError(result.error || t("workflowFailedToDelete"));
      }
    } catch (err: any) {
      setError(err.message || t("workflowFailedToDelete"));
    }
  };

  const toggleWorkflow = async (workflow: WorkflowType) => {
    try {
      const response = await fetch(`/api/beta/workflows/${workflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !workflow.enabled }),
      });

      const result = await response.json();

      if (result.ok) {
        await fetchWorkflows();
      } else {
        setError(result.error || t("workflowFailedToUpdate"));
      }
    } catch (err: any) {
      setError(err.message || t("workflowFailedToUpdate"));
    }
  };

  const executeWorkflow = async (workflowId: string) => {
    setExecutingWorkflow(workflowId);
    
    try {
      const response = await fetch("/api/insight/runWorkflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });

      const result = await response.json();

      if (result.ok) {
        alert(t("workflowExecuted").replace("{message}", result.message || t("workflowUpdate")));
      } else {
        setError(result.error || t("workflowFailedToExecute"));
      }
    } catch (err: any) {
      setError(err.message || t("workflowFailedToExecute"));
    } finally {
      setExecutingWorkflow(null);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">{t("workflowMyAutomations")}</h3>
          <p className="text-sm text-slate-500 mt-1">{t("workflowMultiAgentEngine")}</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 flex items-center gap-2"
        >
          <Plus size={16} />
          {t("workflowNewWorkflow")}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      {showCreateForm && (
        <WorkflowForm
          onSave={createWorkflow}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {loading ? (
        <div className="text-center py-8">
          <Loader2 size={24} className="animate-spin mx-auto text-slate-400" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Zap size={48} className="mx-auto mb-3 opacity-50" />
          <p>{t("workflowNoWorkflows")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{workflow.name}</h4>
                    <button
                      onClick={() => toggleWorkflow(workflow)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {workflow.enabled ? (
                        <ToggleRight size={20} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={20} />
                      )}
                    </button>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      workflow.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      {workflow.enabled ? t("workflowEnabled") : t("workflowDisabled")}
                    </span>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-slate-500 mb-2">{workflow.description}</p>
                  )}
                  <div className="text-xs text-slate-500 space-y-1">
                    <p><span className="font-semibold">{t("workflowTrigger")}</span> {workflow.trigger}</p>
                    {workflow.condition && (
                      <p>
                        <span className="font-semibold">{t("workflowCondition")}</span> {workflow.condition.field} {workflow.condition.operator} {workflow.condition.value}
                      </p>
                    )}
                    <p>
                      <span className="font-semibold">{t("workflowActions")}</span> {workflow.actions.join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => executeWorkflow(workflow.id)}
                    disabled={executingWorkflow === workflow.id}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 flex items-center gap-1 disabled:opacity-50"
                  >
                    {executingWorkflow === workflow.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Play size={12} />
                    )}
                    {t("workflowRun")}
                  </button>
                  <button
                    onClick={() => setEditingWorkflow(workflow)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    aria-label={t("workflowEditWorkflow")}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => deleteWorkflow(workflow.id)}
                    className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingWorkflow && (
        <WorkflowForm
          workflow={editingWorkflow}
          onSave={async (workflow) => {
            // Update workflow
            try {
              const response = await fetch(`/api/beta/workflows/${editingWorkflow.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(workflow),
              });

              const result = await response.json();

              if (result.ok) {
                await fetchWorkflows();
                setEditingWorkflow(null);
                return true;
              } else {
                setError(result.error || t("workflowFailedToUpdate"));
                return false;
              }
            } catch (err: any) {
              setError(err.message || t("workflowFailedToUpdate"));
              return false;
            }
          }}
          onCancel={() => setEditingWorkflow(null)}
        />
      )}
    </div>
  );
}

function WorkflowForm({
  workflow,
  onSave,
  onCancel,
}: {
  workflow?: WorkflowType;
  onSave: (workflow: Omit<WorkflowType, "id" | "createdAt" | "updatedAt">) => Promise<boolean>;
  onCancel: () => void;
}) {
  const t = useTranslation();
  const [name, setName] = useState(workflow?.name || "");
  const [description, setDescription] = useState(workflow?.description || "");
  const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow?.trigger || "email.received");
  const [conditionField, setConditionField] = useState(workflow?.condition?.field || "subject");
  const [conditionOperator, setConditionOperator] = useState<WorkflowCondition["operator"]>(workflow?.condition?.operator || "contains");
  const [conditionValue, setConditionValue] = useState(workflow?.condition?.value || "");
  const [actions, setActions] = useState<string[]>(workflow?.actions || []);
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);

  const availableTriggers = [
    "email.received",
    "calendar.event.created",
    "metric.updated",
    "time-based",
    "user-initiated",
  ];

  const availableActions = [
    "aloha.reorganize",
    "aloha.scheduleFollowup",
    "sync.summarize",
    "sync.createTask",
    "studio.logMetric",
    "studio.updateMetric",
    "insight.combineOutputs",
    "insight.sendSummary",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const workflowData: Omit<WorkflowType, "id" | "createdAt" | "updatedAt"> = {
      name,
      description,
      trigger: trigger as any,
      condition: conditionValue
        ? {
            field: conditionField,
            operator: conditionOperator as any,
            value: conditionValue,
          }
        : undefined,
      actions: actions as any[],
      enabled,
    };

    await onSave(workflowData);
  };

  const toggleAction = (action: string) => {
    if (actions.includes(action)) {
      setActions(actions.filter((a) => a !== action));
    } else {
      setActions([...actions, action]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white/80 p-4 mb-4 dark:border-slate-800 dark:bg-slate-900/60">
      <h4 className="font-semibold mb-4">{workflow ? t("workflowEditWorkflow") : t("workflowCreateWorkflow")}</h4>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">{t("workflowName")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">{t("workflowDescription")}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">{t("workflowTriggerLabel")}</label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as WorkflowTrigger)}
            required
            className="w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
          >
            {availableTriggers.map((trig) => (
              <option key={trig} value={trig}>
                {trig}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">{t("workflowConditionOptional")}</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={conditionField}
              onChange={(e) => setConditionField(e.target.value)}
              placeholder={t("workflowConditionField")}
              className="rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
            />
            <select
              value={conditionOperator}
              onChange={(e) => setConditionOperator(e.target.value as WorkflowCondition["operator"])}
              className="rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
            >
              <option value="contains">{t("workflowConditionContains")}</option>
              <option value="equals">{t("workflowConditionEquals")}</option>
              <option value="greaterThan">{t("workflowConditionGreaterThan")}</option>
              <option value="lessThan">{t("workflowConditionLessThan")}</option>
              <option value="exists">{t("workflowConditionExists")}</option>
            </select>
            <input
              type="text"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder={t("workflowConditionValue")}
              className="rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">{t("workflowActionsLabel")}</label>
          <div className="space-y-2">
            {availableActions.map((action) => (
              <label key={action} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={actions.includes(action)}
                  onChange={() => toggleAction(action)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm">{action}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm font-semibold">{t("workflowEnabledLabel")}</span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            {workflow ? t("workflowUpdate") : t("workflowCreate")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </form>
  );
}

