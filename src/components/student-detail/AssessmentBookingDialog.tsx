import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: Date, time: string) => void;
  loading?: boolean;
}

export function AssessmentBookingDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");

  const handleConfirm = () => {
    if (!selectedDate || !time) return;
    onConfirm(selectedDate, time);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Book Assessment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Assessment Date</Label>
            <div className="flex justify-center mt-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
              />
            </div>
          </div>

          <div>
            <Label>Assessment Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!selectedDate || !time || loading}>
            {loading ? "Saving…" : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
