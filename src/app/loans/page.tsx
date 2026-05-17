import { returnLoanAction } from "@/app/actions";
import { Card, EmptyState, PageHeader, SubmitButton } from "@/components/ui";
import { getLoans } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const [active, history] = await Promise.all([getLoans(true), getLoans(false)]);
  return <><PageHeader eyebrow="Loans" title="Books visiting friends" /><section className="grid gap-6 lg:grid-cols-2"><Card><h2 className="font-serif text-2xl font-bold">Active loans</h2><div className="mt-4 space-y-3">{active.length ? active.map(({ loan, book, copy }) => <div key={loan.id} className="rounded-2xl bg-white/60 p-4"><h3 className="font-bold">{book.title}</h3><p className="text-sm text-[#704b38]">Copy #{copy.copyNumber} loaned to {loan.borrowerName} on {loan.dateLoaned}</p>{loan.contactInfo ? <p className="text-sm text-[#704b38]">Contact: {loan.contactInfo}</p> : null}<form action={returnLoanAction.bind(null, loan.id, copy.id)} className="mt-3"><SubmitButton>Mark returned</SubmitButton></form></div>) : <EmptyState title="No active loans." />}</div></Card><Card><h2 className="font-serif text-2xl font-bold">Loan history</h2><div className="mt-4 space-y-3">{history.length ? history.map(({ loan, book, copy }) => <div key={loan.id} className="rounded-2xl bg-white/60 p-4"><h3 className="font-bold">{book.title}</h3><p className="text-sm text-[#704b38]">Copy #{copy.copyNumber} · {loan.borrowerName} · {loan.dateLoaned}{loan.dateReturned ? ` → ${loan.dateReturned}` : " · still out"}</p>{loan.notes ? <p className="mt-2 text-sm">{loan.notes}</p> : null}</div>) : <EmptyState title="Loan history is empty." />}</div></Card></section></>;
}
