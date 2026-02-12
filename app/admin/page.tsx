"use client"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MapPin,
  FileText,
  CheckCircle,
  Globe,
  ArrowRight,
} from "lucide-react"

interface DashboardStats {
  totalCities: number
  publishedCities: number
  activeTemplates: number
  assignedCities: number
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: any
  color: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold" data-testid={`text-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" data-testid="text-admin-title">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage your city locations and content templates
        </p>
      </div>

      {isLoading ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Cities"
            value={stats.totalCities}
            icon={MapPin}
            color="#3b82f6"
          />
          <StatCard
            label="Published"
            value={stats.publishedCities}
            icon={CheckCircle}
            color="#22c55e"
          />
          <StatCard
            label="Active Templates"
            value={stats.activeTemplates}
            icon={FileText}
            color="#a855f7"
          />
          <StatCard
            label="Assigned"
            value={stats.assignedCities}
            icon={Globe}
            color="#f97316"
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/cities" data-testid="link-manage-cities">
          <Card className="group cursor-pointer p-6 hover-elevate">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Manage Cities</h3>
                  <p className="text-sm text-muted-foreground">
                    View, edit, and publish city pages
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/templates" data-testid="link-manage-templates">
          <Card className="group cursor-pointer p-6 hover-elevate">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Content Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    Create and manage content templates
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
