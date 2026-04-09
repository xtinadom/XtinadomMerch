import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { MerchQuoteContactForm } from "@/components/MerchQuoteContactForm";
import { SHOP_ALL_ROUTE } from "@/lib/constants";

export const metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <StoreDocumentPanel
      backHref={SHOP_ALL_ROUTE}
      backLabel="Back to shop"
      title="Merch website quote"
    >
      <p className="text-sm text-zinc-500">
        Tell us about your brand and what you&apos;re looking for. We&apos;ll follow up with a
        quote.
      </p>
      <MerchQuoteContactForm />
    </StoreDocumentPanel>
  );
}
