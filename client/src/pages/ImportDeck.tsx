import { useState } from "react";
import { Link, useLocation } from "wouter";
import Papa from "papaparse";
import { useImportDeck } from "@/hooks/use-decks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, CheckCircle2 } from "lucide-react";

export default function ImportDeck() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [deckInfo, setDeckInfo] = useState({ title: "", description: "", category: "General" });
  const [csvContent, setCsvContent] = useState("");
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [parsedCards, setParsedCards] = useState<any[]>([]);

  const importDeck = useImportDeck();

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|tsv)$/i.test(file.name)) {
      toast({ title: "Unsupported file", description: "Choose a CSV or TSV file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Limit imports to 2 MB per file.", variant: "destructive" });
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) throw new Error("File is empty");
      setCsvContent(text.replace(/^\uFEFF/, ""));
      setSelectedFilename(file.name);
      setDeckInfo(prev => ({
        ...prev,
        title: prev.title || file.name.replace(/\.(csv|tsv)$/i, "").replace(/[_-]/g, " "),
      }));
      setParsedCards([]);
      setStep(1);
    } catch {
      toast({ title: "Could not read file", description: "Please choose a valid CSV or TSV file.", variant: "destructive" });
    }
  };

  const handleParse = () => {
    if (!csvContent.trim()) {
      toast({ title: "Empty content", description: "Please paste CSV content first.", variant: "destructive" });
      return;
    }

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // Auto-detect comma or tab separators.
      complete: (results) => {
        if (results.errors.length > 0) {
          toast({ title: "CSV Error", description: "Failed to parse CSV.", variant: "destructive" });
          return;
        }

        const validCards = results.data.map((row: any) => {
            // Basic validation and transformation
            return {
                front: row.Front || row.Question || "",
                back: row.Back || row.Answer || "",
                type: row.Type?.toLowerCase() || "flashcard",
                correctOption: row.CorrectOption || null,
                options: [row.OptionA, row.OptionB, row.OptionC, row.OptionD].filter(Boolean),
            };
        }).filter(c => c.front && c.back);

        if (validCards.length === 0) {
            toast({ title: "No valid cards", description: "Could not find valid Front/Back columns.", variant: "destructive" });
            return;
        }

        setParsedCards(validCards);
        setStep(2);
      }
    });
  };

  const handleImport = async () => {
    try {
      await importDeck.mutateAsync({
        deck: {
          title: deckInfo.title,
          description: deckInfo.description,
          category: deckInfo.category,
        },
        cards: parsedCards,
      });

      toast({ title: "Success!", description: "Deck imported successfully." });
      setLocation("/");
    } catch (err) {
      toast({ title: "Import failed", description: "Something went wrong.", variant: "destructive" });
    }
  };

  const isPending = importDeck.isPending;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/">
          <Button variant="ghost" className="pl-0 hover:pl-2 transition-all">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold">Import New Deck</h1>
          <div className="flex gap-2">
            <div className={`h-2 w-8 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`} />
            <div className={`h-2 w-8 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`} />
          </div>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4">
            <Card className="rounded-2xl border-none shadow-lg">
              <CardHeader>
                <CardTitle>Deck Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input 
                    placeholder="e.g. History Trivia" 
                    value={deckInfo.title}
                    onChange={e => setDeckInfo(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input 
                    placeholder="e.g. History"
                    value={deckInfo.category}
                    onChange={e => setDeckInfo(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Brief description..."
                    value={deckInfo.description}
                    onChange={e => setDeckInfo(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-none shadow-lg">
              <CardHeader>
                <CardTitle>Upload study cards (CSV or TSV)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                  <strong>Format:</strong> Front, Back, Type, OptionA, OptionB, OptionC, OptionD, CorrectOption
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deck-file">Choose a file from your device</Label>
                  <Input
                    id="deck-file"
                    type="file"
                    accept=".csv,.tsv,text/csv,text/tab-separated-values"
                    onChange={e => void handleFile(e.target.files?.[0])}
                    aria-describedby="upload-help"
                  />
                  <p id="upload-help" className="text-xs text-muted-foreground">
                    Up to 2 MB. {selectedFilename ? `Selected: ${selectedFilename}` : "Or paste CSV/TSV text below."}
                    The imported cards are saved to the configured PostgreSQL database. The original file is not yet archived.
                  </p>
                </div>
                <Textarea
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Paste CSV content here..."
                  value={csvContent}
                  onChange={e => setCsvContent(e.target.value)}
                />
                <Button 
                  className="w-full rounded-xl" 
                  onClick={handleParse}
                  disabled={!deckInfo.title || !csvContent}
                >
                  Preview & Validate <Upload className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <Card className="rounded-2xl border-none shadow-lg animate-in slide-in-from-right-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Preview ({parsedCards.length} Cards)</CardTitle>
              <Button variant="outline" onClick={() => setStep(1)}>Edit CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Front / Question</TableHead>
                      <TableHead>Back / Answer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Options</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedCards.map((card, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{card.front}</TableCell>
                        <TableCell>{card.back}</TableCell>
                        <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${card.type === 'multiple_choice' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                {card.type}
                            </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {card.options?.length > 0 ? card.options.join(', ') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="pt-6">
                <Button 
                  className="w-full h-12 text-lg font-bold rounded-xl" 
                  onClick={handleImport}
                  disabled={isPending}
                >
                  {isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Importing...</>
                  ) : (
                    <><CheckCircle2 className="mr-2 h-5 w-5" /> Import {parsedCards.length} Cards</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
