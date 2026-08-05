import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv"

export function ExportCsvButton<T extends Record<string, unknown>>({
  rows,
  columns,
  filename,
}: {
  rows: T[]
  columns: CsvColumn<T>[]
  filename: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, toCsv(rows, columns))}
    >
      <Download className="size-4" />
      Export CSV
    </Button>
  )
}
