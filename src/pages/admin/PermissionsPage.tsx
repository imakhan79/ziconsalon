import { Check, Minus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const MODULES = [
  { name: "Executive / Super Admin", access: ["admin"] },
  { name: "Branch Management", access: ["admin"] },
  { name: "User Management", access: ["admin"] },
  { name: "Integrations & System Config", access: ["admin"] },
  { name: "Reports & Analytics", access: ["admin", "manager"] },
  { name: "Staff Management", access: ["admin", "manager"] },
  { name: "Services & Pricing", access: ["admin", "manager"] },
  { name: "Inventory", access: ["admin", "manager"] },
  { name: "Finance & Expenses", access: ["admin", "manager"] },
  { name: "Marketing & Promotions", access: ["admin", "manager"] },
  { name: "Customers", access: ["admin", "manager", "staff"] },
  { name: "Billing & Invoices", access: ["admin", "manager", "staff"] },
  { name: "Appointments", access: ["admin", "manager", "staff", "customer"] },
  { name: "Own Profile & Settings", access: ["admin", "manager", "staff", "customer"] },
]

const ROLES = [
  { key: "admin", label: "Admin", sub: "Super Administrator" },
  { key: "manager", label: "Manager", sub: "Branch Administrator" },
  { key: "staff", label: "Staff", sub: "Receptionist / Stylist" },
  { key: "customer", label: "Customer", sub: "Self-service" },
]

export default function PermissionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Permissions</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role capability matrix</CardTitle>
          <CardDescription>
            This mirrors the actual route guards and Postgres row-level security policies enforced
            server-side — it is a reference, not a separate configurable permission engine. To change
            access, reassign a user's role from User Management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {ROLES.map((r) => (
                  <TableHead key={r.key} className="text-center">
                    {r.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULES.map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  {ROLES.map((r) => (
                    <TableCell key={r.key} className="text-center">
                      {m.access.includes(r.key) ? (
                        <Check className="mx-auto size-4 text-accent" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground/40" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <Card key={r.key}>
            <CardContent className="flex flex-col gap-1">
              <span className="font-display text-lg font-semibold">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.sub}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
