import { VaultGate } from "@/components/VaultGate";
import { CredentialsView } from "@/components/CredentialsView";

export default function Home() {
  return (
    <VaultGate>
      <CredentialsView />
    </VaultGate>
  );
}
