import { useState } from "react";
import { Link, useLocation } from "wouter";
import { parseDeckContent, MAX_DECK_FILE_BYTES, type ImportableCard } from "@/lib/deck-io";
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
  const [parsedCards, setParsedCards] = useState<ImportableCard[]>([]);

  const importDeck = useImportDeck();

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|tsv|json)$/i.test(file.name)) {
      toast({ title: "Unsupported file", description: "Choose CSV, TSV, or a Trivia Lobby JSON backup.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_DECK_FILE_BYTES) {
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
        title: prev.title || (/\.json$/i.test(file.name) ? "" : file.name.replace(/\.(csv|tsv)$/i, "").replace(/[_-]/g, " ")),
      }));
      setParsedCards([]);
      setStep(1);
    } catch {
      toast({ title: "Could not read file", description: "Please choose a readable CSV, TSV, or Trivia Lobby JSON backup.", variant: "destructive" });
    }
  };

  const handleParse = () => {
    try {
      const sourceName = selectedFilename || (csvContent.includes("\t") ? "paste.tsv" : "paste.csv");
      const parsed = parseDeckContent(csvContent, sourceName);
      if (parsed.title) {
        setDeckInfo(prev => ({
          title: prev.title || parsed.title || "",
          description: prev.description || parsed.description || "",
          category: prev.category !== "General" ? prev.category : (parsed.category || "General"),
        }));
      }
      setParsedCards(parsed.cards);
      setStep(2);
    } catch (error) {
      toast({
        title: "Import validation failed",
        description: error instanceof Error ? error.message : "Check your file format.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (isPending) return;
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
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
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
                <CardTitle>Import study cards or restore a backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                  <strong>CSV/TSV headers:</strong> Front, Back, Type, OptionA, OptionB, OptionC, OptionD, CorrectOption. Or use a Trivia Lobby JSON backup.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deck-file">Choose a file from your device</Label>
                  <Input
                    id="deck-file"
                    type="file"
                    accept=".csv,.tsv,.json,text/csv,text/tab-separated-values,application/json"
                    onChange={e => void handleFile(e.target.files?.[0])}
                    aria-describedby="upload-help"
                  />
                  <p id="upload-help" className="text-xs text-muted-foreground">
                    Up to 2 MB. CSV/TSV and Trivia Lobby JSON backups supported. {selectedFilename ? `Selected: ${selectedFilename}` : "Or paste CSV/TSV text below."}
                    The imported cards are saved to the configured PostgreSQL database. The original file is not yet archived.
                  </p>
                </div>
                <Textarea
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Paste CSV or TSV content here..."
                  value={csvContent}
                  onChange={e => { setCsvContent(e.target.value); setSelectedFilename(null); }}
                />
                <Button 
                  className="w-full rounded-xl" 
                  onClick={handleParse}
                  disabled={!csvContent || (!deckInfo.title && !selectedFilename?.toLowerCase().endsWith(".json"))}
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
