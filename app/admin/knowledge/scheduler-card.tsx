"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Zap, Pause, Play } from "lucide-react"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

interface SchedulerConfig {
  id: string
  enabled: boolean
  pairingsPerDay: number
  dailyBudgetUsd: string
  pickerStrategy: "balanced" | "newest_first" | "random"
  pausedReason: string | null
  lastTickAt: string | null
  updatedAt: string
}

interface SchedulerRun {
  id: string
  tickAt: string
  triggeredBy: string
  outcome: string
  hayloArticleId: string | null
  citySlug: string | null
  verdict: string | null
  flowScore: number | null
  knowledgeArticleId: string | null
  reviewQueueId: string | null
  costUsd: string | null
  totalTokens: number | null
  durationMs: number | null
  notes: string | null
}

interface ConfigPayload { config: SchedulerConfig; cronSecretSet: boolean }
interface RunsPayload {
  runs: SchedulerRun[]
  today: { pairings: number; passes: number; warns: number; fails: number; errors: number; costUsd: number; tokens: number }
  eligiblePairs: number
}

const OUTCOME_BADGES: Record<string, { label: string; className: string }> = {
  paired_pass: { label: "PASS", className: "bg-green-100 text-green-800 border-green-300" },
  paired_warn: { label: "WARN", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  paired_fail: { label: "FAIL", className: "bg-red-100 text-red-800 border-red-300" },
  skipped_no_eligible: { label: "no eligible pairs", className: "bg-slate-100 text-slate-700 border-slate-300" },
  skipped_disabled: { label: "disabled", className: "bg-slate-100 text-slate-700 border-slate-300" },
  skipped_quota: { label: "daily quota", className: "bg-blue-100 text-blue-800 border-blue-300" },
  skipped_budget: { label: "budget", className: "bg-blue-100 text-blue-800 border-blue-300" },
  skipped_locked: { label: "locked", className: "bg-slate-100 text-slate-700 border-slate-300" },
  error: { label: "ERROR", className: "bg-red-100 text-red-800 border-red-300" },
}

export function SchedulerCard() {
  const { toast } = useToast()
  const { data: configData, isLoading: configLoading } = useQuery<ConfigPayload>({
    queryKey: ["/api/admin/newsroom/scheduler/config"],
  })
  const { data: runsData, isLoading: runsLoading } = useQuery<RunsPayload>({
    queryKey: ["/api/admin/newsroom/scheduler/runs"],
    refetchInterval: 15000,
  })

  const [pairingsPerDay, setPairingsPerDay] = useState<string>("5")
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState<string>("1.00")
  const [pickerStrategy, setPickerStrategy] = useState<"balanced" | "newest_first" | "random">("balanced")

  useEffect(() => {
    if (configData?.config) {
      setPairingsPerDay(String(configData.config.pairingsPerDay))
      setDailyBudgetUsd(String(configData.config.dailyBudgetUsd))
      setPickerStrategy(configData.config.pickerStrategy)
    }
  }, [configData])

  const patchConfig = useMutation({
    mutationFn: async (patch: Partial<{ enabled: boolean; pairingsPerDay: number; dailyBudgetUsd: number; pickerStrategy: string }>) => {
      const res = await apiRequest("PATCH", "/api/admin/newsroom/scheduler/config", patch)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/scheduler/config"] })
      toast({ title: "Scheduler updated" })
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" })
    },
  })

  const runTick = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/newsroom/scheduler/tick-now", {})
      return res.json()
    },
    onSuccess: (data) => {
      const r = data.result
      const badge = OUTCOME_BADGES[r.outcome]?.label ?? r.outcome
      toast({
        title: `Tick: ${badge}`,
        description: r.citySlug ? `${r.citySlug} (${r.flowScore ?? "—"}/100, $${Number(r.costUsd ?? 0).toFixed(4)})` : (r.notes ?? ""),
      })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/scheduler/runs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
    },
    onError: (e: Error) => {
      toast({ title: "Tick failed", description: e.message, variant: "destructive" })
    },
  })

  if (configLoading || !configData) {
    return (
      <Card className="p-4">
        <Skeleton className="h-32 w-full" />
      </Card>
    )
  }

  const config = configData.config
  const today = runsData?.today
  const eligible = runsData?.eligiblePairs ?? 0

  return (
    <Card className="p-4 border-2 border-blue-200 dark:border-blue-900">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-base" data-testid="text-scheduler-title">Auto-Schedule (drip publishing)</h3>
          {config.enabled ? (
            <Badge className="bg-green-100 text-green-800 border-green-300" data-testid="badge-scheduler-status">
              <Play className="h-3 w-3 mr-1" />
              ON
            </Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-700 border-slate-300" data-testid="badge-scheduler-status">
              <Pause className="h-3 w-3 mr-1" />
              PAUSED
            </Badge>
          )}
        </div>
        <Switch
          checked={config.enabled}
          disabled={patchConfig.isPending}
          onCheckedChange={(checked) => patchConfig.mutate({ enabled: checked })}
          data-testid="switch-scheduler-enabled"
        />
      </div>

      {!configData.cronSecretSet && (
        <div className="mb-3 p-2 rounded text-xs bg-yellow-50 text-yellow-900 border border-yellow-200" data-testid="text-cron-secret-warning">
          <strong>CRON_SECRET is not set.</strong> The scheduler can be triggered manually below, but Replit Scheduled Deployments cannot call the cron route until you add this secret.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded p-2 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Today's Pairings</div>
          <div className="text-lg font-semibold" data-testid="text-today-pairings">
            {today?.pairings ?? 0} <span className="text-sm text-muted-foreground">/ {config.pairingsPerDay}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {today?.passes ?? 0} pass · {today?.warns ?? 0} warn · {today?.fails ?? 0} fail
          </div>
        </div>
        <div className="rounded p-2 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Today's Cost</div>
          <div className="text-lg font-semibold" data-testid="text-today-cost">
            ${(today?.costUsd ?? 0).toFixed(4)}
            <span className="text-sm text-muted-foreground"> / ${Number(config.dailyBudgetUsd).toFixed(2)}</span>
          </div>
          <div className="text-xs text-muted-foreground">{(today?.tokens ?? 0).toLocaleString()} tokens</div>
        </div>
        <div className="rounded p-2 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Eligible Pairs Remaining</div>
          <div className="text-lg font-semibold" data-testid="text-eligible-pairs">{eligible}</div>
          <div className="text-xs text-muted-foreground">(haylo × city, not yet paired)</div>
        </div>
        <div className="rounded p-2 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-muted-foreground">Last Tick</div>
          <div className="text-sm font-medium" data-testid="text-last-tick">
            {config.lastTickAt ? new Date(config.lastTickAt).toLocaleString() : "never"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <Label className="text-xs">Pairings per day</Label>
          <Input
            type="number"
            min={0}
            max={50}
            value={pairingsPerDay}
            onChange={(e) => setPairingsPerDay(e.target.value)}
            onBlur={() => {
              const n = Number(pairingsPerDay)
              if (Number.isFinite(n) && n !== config.pairingsPerDay) patchConfig.mutate({ pairingsPerDay: n })
            }}
            data-testid="input-pairings-per-day"
          />
        </div>
        <div>
          <Label className="text-xs">Daily budget (USD)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={dailyBudgetUsd}
            onChange={(e) => setDailyBudgetUsd(e.target.value)}
            onBlur={() => {
              const n = Number(dailyBudgetUsd)
              if (Number.isFinite(n) && n !== Number(config.dailyBudgetUsd)) patchConfig.mutate({ dailyBudgetUsd: n })
            }}
            data-testid="input-daily-budget"
          />
        </div>
        <div>
          <Label className="text-xs">Picker strategy</Label>
          <Select
            value={pickerStrategy}
            onValueChange={(v) => {
              const next = v as "balanced" | "newest_first" | "random"
              setPickerStrategy(next)
              patchConfig.mutate({ pickerStrategy: next })
            }}
          >
            <SelectTrigger data-testid="select-picker-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">Balanced (spread library + cities)</SelectItem>
              <SelectItem value="newest_first">Newest Haylo first</SelectItem>
              <SelectItem value="random">Random eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => { if (!runTick.isPending) runTick.mutate(); }}
          data-testid="button-tick-now"
          aria-busy={runTick.isPending}
        >
          {runTick.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
          Run a tick now
        </Button>
        <span className="text-xs text-muted-foreground">
          Picks the next eligible pair, runs the 5-agent pipeline, saves the result. Useful for testing without waiting for cron.
        </span>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Recent ticks</Label>
        <div className="mt-1 border rounded divide-y max-h-64 overflow-y-auto">
          {runsLoading && <div className="p-3"><Skeleton className="h-4 w-full" /></div>}
          {!runsLoading && (runsData?.runs.length ?? 0) === 0 && (
            <div className="p-3 text-xs text-muted-foreground" data-testid="text-no-runs">No ticks yet — turn the scheduler on or click "Run a tick now".</div>
          )}
          {runsData?.runs.map((r) => {
            const badge = OUTCOME_BADGES[r.outcome] ?? { label: r.outcome, className: "bg-slate-100 text-slate-700 border-slate-300" }
            return (
              <div key={r.id} className="p-2 flex items-center gap-2 text-xs flex-wrap" data-testid={`row-tick-${r.id}`}>
                <span className="text-muted-foreground tabular-nums">{new Date(r.tickAt).toLocaleString()}</span>
                <Badge variant="outline" className="text-[10px]">{r.triggeredBy}</Badge>
                <Badge className={badge.className}>{badge.label}</Badge>
                {r.citySlug && <span className="font-mono">{r.citySlug}</span>}
                {r.flowScore != null && <span className="text-muted-foreground">{r.flowScore}/100</span>}
                {r.costUsd && <span className="text-muted-foreground">${Number(r.costUsd).toFixed(4)}</span>}
                {r.durationMs != null && <span className="text-muted-foreground">{(r.durationMs / 1000).toFixed(1)}s</span>}
                {r.notes && <span className="text-muted-foreground italic line-clamp-1 flex-1 min-w-0">{r.notes}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
