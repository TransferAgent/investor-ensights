import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search,
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import type { CityLocation, ContentTemplate } from "@shared/schema";

export default function AdminCitiesPage() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const { toast } = useToast();

  const { data: cities = [], isLoading } = useQuery<CityLocation[]>({
    queryKey: ["/api/admin/cities"],
  });

  const { data: templates = [] } = useQuery<ContentTemplate[]>({
    queryKey: ["/api/admin/templates"],
  });

  const states = useMemo(() => {
    const s = new Set(cities.map((c) => c.stateCode));
    return Array.from(s).sort();
  }, [cities]);

  const filtered = useMemo(() => {
    return cities.filter((c) => {
      const matchSearch =
        !search ||
        c.cityName.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase()) ||
        c.stateCode.toLowerCase().includes(search.toLowerCase());
      const matchState = !stateFilter || c.stateCode === stateFilter;
      const matchStatus =
        !statusFilter ||
        (statusFilter === "published" && c.isPublished) ||
        (statusFilter === "draft" && !c.isPublished);
      return matchSearch && matchState && matchStatus;
    });
  }, [cities, search, stateFilter, statusFilter]);

  const bulkPublishMutation = useMutation({
    mutationFn: async (action: string) => {
      await apiRequest("POST", "/api/admin/bulk-update", {
        cityIds: Array.from(selectedIds),
        action,
      });
    },
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIds(new Set());
      toast({
        title: "Success",
        description: `Cities ${action === "publish" ? "published" : "unpublished"} successfully`,
      });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/bulk-update", {
        cityIds: Array.from(selectedIds),
        action: "assign_template",
        templateId: selectedTemplateId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      setSelectedIds(new Set());
      setSelectedTemplateId("");
      toast({
        title: "Success",
        description: "Template assigned to selected cities",
      });
    },
  });

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-cities-title">
            City Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {cities.length} total cities &middot; {selectedIds.size} selected
          </p>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-medium">
            {selectedIds.size} selected:
          </span>
          <Button
            size="sm"
            onClick={() => bulkPublishMutation.mutate("publish")}
            disabled={bulkPublishMutation.isPending}
            data-testid="button-bulk-publish"
          >
            {bulkPublishMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="mr-1.5 h-3.5 w-3.5" />
            )}
            Publish
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkPublishMutation.mutate("unpublish")}
            disabled={bulkPublishMutation.isPending}
            data-testid="button-bulk-unpublish"
          >
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            Unpublish
          </Button>

          <div className="flex items-center gap-2">
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger className="w-48" data-testid="select-assign-template">
                <SelectValue placeholder="Pick template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.templateName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedTemplateId || bulkAssignMutation.isPending}
              onClick={() => bulkAssignMutation.mutate()}
              data-testid="button-apply-template"
            >
              {bulkAssignMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5" />
              )}
              Apply Template
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            data-testid="button-clear-selection"
          >
            Clear
          </Button>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search cities..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-admin-search"
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          data-testid="select-admin-state"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="select-admin-status"
        >
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {isLoading ? (
        <Card className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b py-3 last:border-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={
                        filtered.length > 0 && selectedIds.size === filtered.length
                      }
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">City</th>
                  <th className="px-4 py-3 text-left font-medium">State</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Slug</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((city) => (
                  <tr
                    key={city.id}
                    className="border-b last:border-0"
                    data-testid={`row-city-${city.slug}`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(city.id)}
                        onCheckedChange={() => toggleOne(city.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{city.cityName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {city.stateCode}
                    </td>
                    <td className="px-4 py-3">
                      {city.isPublished ? (
                        <Badge variant="default">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" />
                          Draft
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {city.slug}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/locations/${city.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-view-${city.slug}`}
                      >
                        <Button size="sm" variant="ghost">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              No cities match your filters
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
