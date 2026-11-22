import { Suspense } from "react";
import BirthdayExperience from "@/components/BirthdayExperience";
import { PERSON } from "@/lib/config";

/** Personalised link previews (WhatsApp, iMessage…) when the page is shared. */
export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params?.name) ? params.name[0] : params?.name;
  const name = (raw || PERSON.name).toString().trim().slice(0, 40) || PERSON.name;
  return {
    title: `For ${name}`,
    description: `A birthday surprise for ${name}. Open it and blow out the candles.`,
  };
}

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" />}>
      <BirthdayExperience />
    </Suspense>
  );
}
