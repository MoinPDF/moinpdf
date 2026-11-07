const messages: Record<string, [string, string]> = {
  installation_busy: [
    'Der KI-Dienst dieser Installation ist gerade ausgelastet. Bitte nach der angezeigten Wartezeit erneut senden.',
    'This installation’s AI service is busy. Send again after the displayed waiting time.',
  ],
  installation_rate_limit: [
    'Das Stundenlimit für den KI-Zugang dieser Installation ist erreicht. Bitte nach der angezeigten Wartezeit erneut senden.',
    'The hourly limit for this installation’s AI access has been reached. Send again after the displayed waiting time.',
  ],
  openai_credit_exhausted: [
    'Das OpenAI-API-Guthaben ist aufgebraucht. Im zugehörigen OpenAI-API-Konto Guthaben ergänzen. Warten allein hilft hier nicht.',
    'The OpenAI API credit balance is exhausted. Add credits in the associated OpenAI API account. Waiting alone will not resolve this.',
  ],
  openai_spend_limit: [
    'Ein Ausgabenlimit des OpenAI-API-Projekts oder der Organisation ist erreicht. Abrechnung und Limits im zugehörigen API-Konto prüfen.',
    'The OpenAI API project or organization has reached a spend limit. Check billing and limits in the associated API account.',
  ],
  openai_usage_limit: [
    'Das Nutzungslimit der OpenAI-API-Organisation ist erreicht. Das zugehörige API-Konto benötigt ein höheres Nutzungslimit.',
    'The OpenAI API organization has reached its usage limit. The associated API account needs a higher usage limit.',
  ],
  openai_quota_exceeded: [
    'OpenAI meldet ein ausgeschöpftes API-Kontingent. Guthaben, Abrechnung und Nutzungslimits im zugehörigen API-Konto prüfen. Warten allein behebt dies nicht.',
    'OpenAI reports exhausted API quota. Check credits, billing and usage limits in the associated API account. Waiting alone will not resolve this.',
  ],
  openai_rate_limit: [
    'OpenAI begrenzt die Anfragen vorübergehend. Bitte vor dem erneuten Senden warten; eine gemeldete Wartezeit steht unten.',
    'OpenAI is temporarily limiting requests. Wait before sending again; any reported waiting time is shown below.',
  ],
  openai_limit_unknown: [
    'OpenAI hat die Anfrage wegen eines Limits abgewiesen, aber keinen eindeutigen Grund geliefert. API-Guthaben und Limits prüfen; eine Wartezeit ist nicht bekannt.',
    'OpenAI rejected the request due to a limit without a specific reason. Check API credits and limits; no waiting time is known.',
  ],
};

export function datevAiError(status: number, data: unknown) {
  const body = data as { error?: { code?: string }; retryAfterSeconds?: number } | null;
  const code = body?.error?.code;
  const known = status === 429 && typeof code === 'string' && Object.hasOwn(messages, code);
  const retryable =
    known && ['installation_busy', 'installation_rate_limit', 'openai_rate_limit'].includes(code);
  const seconds = body?.retryAfterSeconds;
  return {
    message: known
      ? messages[code]
      : status === 401
        ? [
            'Der persönliche OpenAI-Schlüssel wurde abgelehnt. Bitte Schlüssel und API-Berechtigungen prüfen.',
            'The personal OpenAI key was rejected. Check the key and API permissions.',
          ]
        : status === 403
          ? ['KI-Zugangscode prüfen.', 'Check the AI access code.']
          : status === 429
            ? [
                'Die KI-Anfrage wurde wegen eines Limits abgewiesen. Diese Installation meldet keinen genauen Grund. API-Guthaben und Limits prüfen oder die Installation aktualisieren.',
                'The AI request was rejected due to a limit. This installation does not report a specific reason. Check API credits and limits or update the installation.',
              ]
            : [
                'KI-Dienst nicht erreichbar oder Antwort unbrauchbar. Die manuelle Kontierung ist verfügbar.',
                'The AI service is unavailable or returned an unusable response. Manual entry is available.',
              ],
    retryAfterSeconds:
      retryable &&
      typeof seconds === 'number' &&
      Number.isSafeInteger(seconds) &&
      seconds > 0 &&
      seconds <= 31_536_000
        ? seconds
        : 0,
  };
}
