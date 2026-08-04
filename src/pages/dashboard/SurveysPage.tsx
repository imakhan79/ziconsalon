import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2, ClipboardCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useBranches } from "@/hooks/useBranches"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Survey, SurveyQuestion, SurveyResponse } from "@/types"

interface QuestionDraft {
  text: string
  type: "rating" | "text"
}

const emptyQuestion = (): QuestionDraft => ({ text: "", type: "rating" })

export default function SurveysPage() {
  const queryClient = useQueryClient()
  const { defaultBranchId } = useBranches()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [questions, setQuestions] = React.useState<QuestionDraft[]>([emptyQuestion()])
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("surveys").select("*").order("created_at", { ascending: false })
      if (error) throw error
      return data as Survey[]
    },
  })

  const { data: responses = [] } = useQuery({
    queryKey: ["survey-responses", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*, customer:profiles(*)")
        .eq("survey_id", expandedId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as (SurveyResponse & { customer: { full_name: string } | null })[]
    },
  })

  const { data: responseCounts = {} } = useQuery({
    queryKey: ["survey-response-counts"],
    enabled: surveys.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("survey_responses").select("survey_id")
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const r of data ?? []) counts[r.survey_id] = (counts[r.survey_id] ?? 0) + 1
      return counts
    },
  })

  const createSurvey = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Enter a title")
      const validQuestions = questions.filter((q) => q.text.trim())
      if (validQuestions.length === 0) throw new Error("Add at least one question")
      const payload: SurveyQuestion[] = validQuestions.map((q) => ({ id: crypto.randomUUID(), text: q.text, type: q.type }))
      const { error } = await supabase.from("surveys").insert({
        branch_id: defaultBranchId || null,
        title,
        questions: payload,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] })
      setDialogOpen(false)
      setTitle("")
      setQuestions([emptyQuestion()])
      toast.success("Survey created")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleActive = useMutation({
    mutationFn: async (survey: Survey) => {
      const { error } = await supabase.from("surveys").update({ is_active: !survey.is_active }).eq("id", survey.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["surveys"] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const questionSummary = (survey: Survey, question: SurveyQuestion) => {
    if (expandedId !== survey.id) return null
    if (question.type === "rating") {
      const ratings = responses.map((r) => Number(r.answers[question.id])).filter((n) => !Number.isNaN(n))
      const avg = ratings.length ? (ratings.reduce((s, n) => s + n, 0) / ratings.length).toFixed(1) : "—"
      return <span className="text-muted-foreground">avg {avg} ({ratings.length} responses)</span>
    }
    const texts = responses.map((r) => r.answers[question.id]).filter(Boolean)
    return <span className="text-muted-foreground">{texts.length} responses</span>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Surveys</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setTitle("")
                setQuestions([emptyQuestion()])
              }}
            >
              <Plus /> New survey
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New survey</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                createSurvey.mutate()
              }}
            >
              <div className="flex flex-col gap-2">
                <Label>Title</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How was your visit?" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Questions</Label>
                {questions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Question text"
                      value={q.text}
                      onChange={(e) => setQuestions((qs) => qs.map((item, i) => (i === idx ? { ...item, text: e.target.value } : item)))}
                      className="flex-1"
                    />
                    <Select value={q.type} onValueChange={(v) => setQuestions((qs) => qs.map((item, i) => (i === idx ? { ...item, type: v as "rating" | "text" } : item)))}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">Rating</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== idx))}
                      disabled={questions.length === 1}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>
                  <Plus /> Add question
                </Button>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createSurvey.isPending}>
                  {createSurvey.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && surveys.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ClipboardCheck className="size-8 opacity-50" />
            No surveys yet.
          </CardContent>
        </Card>
      )}

      {surveys.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{s.title}</CardTitle>
                <Badge variant={s.is_active ? "success" : "outline"}>{s.is_active ? "Active" : "Inactive"}</Badge>
                <span className="text-xs text-muted-foreground">{responseCounts[s.id] ?? 0} responses</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  {expandedId === s.id ? "Hide" : "View responses"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleActive.mutate(s)}>
                  {s.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {s.questions.map((q) => (
              <div key={q.id} className="flex items-center justify-between text-sm">
                <span>{q.text}</span>
                {questionSummary(s, q)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
