import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { CityLocation, ContentTemplate } from "@shared/schema";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

interface CityFormData {
  cityName: string;
  stateCode: string;
  stateName: string;
  streetAddress: string;
  zipCode: string;
  phoneNumber: string;
  email: string;
  localLandmarks: string;
  nearbyCities: string;
  isPublished: boolean;
}

const emptyCityForm: CityFormData = {
  cityName: "",
  stateCode: "",
  stateName: "",
  streetAddress: "",
  zipCode: "",
  phoneNumber: "",
  email: "",
  localLandmarks: "",
  nearbyCities: "",
  isPublished: false,
};

function cityToFormData(city: CityLocation): CityFormData {
  return {
    cityName: city.cityName,
    stateCode: city.stateCode,
    stateName: city.stateName || "",
    streetAddress: city.streetAddress || "",
    zipCode: city.zipCode || "",
    phoneNumber: city.phoneNumber || "",
    email: city.email || "",
    localLandmarks: Array.isArray(city.localLandmarks) ? (city.localLandmarks as string[]).join(", ") : "",
    nearbyCities: Array.isArray(city.nearbyCities) ? (city.nearbyCities as string[]).join(", ") : "",
    isPublished: city.isPublished,
  };
}

export default function AdminCitiesPage() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<CityLocation | null>(null);
  const [formData, setFormData] = useState<CityFormData>(emptyCityForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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

  const createCityMutation = useMutation({
    mutationFn: async (data: CityFormData) => {
      const body = {
        cityName: data.cityName,
        stateCode: data.stateCode,
        stateName: data.stateName || US_STATES.find((s) => s.code === data.stateCode)?.name || null,
        streetAddress: data.streetAddress || null,
        zipCode: data.zipCode || null,
        phoneNumber: data.phoneNumber || null,
        email: data.email || null,
        localLandmarks: data.localLandmarks ? data.localLandmarks.split(",").map((s) => s.trim()).filter(Boolean) : [],
        nearbyCities: data.nearbyCities ? data.nearbyCities.split(",").map((s) => s.trim()).filter(Boolean) : [],
        isPublished: data.isPublished,
      };
      const res = await apiRequest("POST", "/api/admin/cities", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDialogOpen(false);
      setFormData(emptyCityForm);
      toast({ title: "City created", description: "The new city has been added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CityFormData }) => {
      const body = {
        cityName: data.cityName,
        stateCode: data.stateCode,
        stateName: data.stateName || US_STATES.find((s) => s.code === data.stateCode)?.name || null,
        streetAddress: data.streetAddress || null,
        zipCode: data.zipCode || null,
        phoneNumber: data.phoneNumber || null,
        email: data.email || null,
        localLandmarks: data.localLandmarks ? data.localLandmarks.split(",").map((s) => s.trim()).filter(Boolean) : [],
        nearbyCities: data.nearbyCities ? data.nearbyCities.split(",").map((s) => s.trim()).filter(Boolean) : [],
        isPublished: data.isPublished,
      };
      const res = await apiRequest("PATCH", `/api/admin/cities/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDialogOpen(false);
      setEditingCity(null);
      setFormData(emptyCityForm);
      toast({ title: "City updated", description: "The city has been updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCityMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/cities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteConfirmId(null);
      toast({ title: "City deleted", description: "The city has been removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  const openAddDialog = () => {
    setEditingCity(null);
    setFormData(emptyCityForm);
    setDialogOpen(true);
  };

  const openEditDialog = (city: CityLocation) => {
    setEditingCity(city);
    setFormData(cityToFormData(city));
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cityName || !formData.stateCode) return;
    if (editingCity) {
      updateCityMutation.mutate({ id: editingCity.id, data: formData });
    } else {
      createCityMutation.mutate(formData);
    }
  };

  const updateField = (field: keyof CityFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isSaving = createCityMutation.isPending || updateCityMutation.isPending;

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
        <Button onClick={openAddDialog} data-testid="button-add-city">
          <Plus className="mr-1.5 h-4 w-4" />
          Add City
        </Button>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(city)}
                          data-testid={`button-edit-${city.slug}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {deleteConfirmId === city.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteCityMutation.mutate(city.id)}
                              disabled={deleteCityMutation.isPending}
                              data-testid={`button-confirm-delete-${city.slug}`}
                            >
                              {deleteCityMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Yes"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(city.id)}
                            data-testid={`button-delete-${city.slug}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <a
                          href={`/locations/${city.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`link-view-${city.slug}`}
                        >
                          <Button size="icon" variant="ghost">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-city-dialog-title">
              {editingCity ? "Edit City" : "Add New City"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cityName">City Name *</Label>
                <Input
                  id="cityName"
                  value={formData.cityName}
                  onChange={(e) => updateField("cityName", e.target.value)}
                  placeholder="e.g. San Diego"
                  required
                  data-testid="input-city-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stateCode">State *</Label>
                <select
                  id="stateCode"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={formData.stateCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const name = US_STATES.find((s) => s.code === code)?.name || "";
                    updateField("stateCode", code);
                    updateField("stateName", name);
                  }}
                  required
                  data-testid="select-city-state"
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input
                id="streetAddress"
                value={formData.streetAddress}
                onChange={(e) => updateField("streetAddress", e.target.value)}
                placeholder="e.g. 123 Main St"
                data-testid="input-street-address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => updateField("zipCode", e.target.value)}
                  placeholder="e.g. 92101"
                  data-testid="input-zip-code"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => updateField("phoneNumber", e.target.value)}
                  placeholder="e.g. (619) 555-0100"
                  data-testid="input-phone"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="e.g. sandiego@yourcompany.com"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="localLandmarks">Local Landmarks (comma-separated)</Label>
              <Input
                id="localLandmarks"
                value={formData.localLandmarks}
                onChange={(e) => updateField("localLandmarks", e.target.value)}
                placeholder="e.g. Balboa Park, San Diego Zoo, Gaslamp Quarter"
                data-testid="input-landmarks"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nearbyCities">Nearby Cities (comma-separated)</Label>
              <Input
                id="nearbyCities"
                value={formData.nearbyCities}
                onChange={(e) => updateField("nearbyCities", e.target.value)}
                placeholder="e.g. Chula Vista, La Jolla, Coronado"
                data-testid="input-nearby-cities"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isPublished"
                checked={formData.isPublished}
                onCheckedChange={(checked) => updateField("isPublished", !!checked)}
                data-testid="checkbox-published"
              />
              <Label htmlFor="isPublished" className="cursor-pointer">
                Publish immediately
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel-city"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !formData.cityName || !formData.stateCode}
                data-testid="button-save-city"
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {editingCity ? "Save Changes" : "Add City"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete City</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this city? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteCityMutation.mutate(deleteConfirmId)}
              disabled={deleteCityMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteCityMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
