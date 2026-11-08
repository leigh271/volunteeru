// No credentials belong in frontend configuration. The backend uses its own
// session and resolves school membership and designated nonprofit recipients.
const configuredBase =
  window.__VOLUNTEERU_API__ || import.meta.env?.VITE_STUDENT_API_URL || "";
export const apiBase =
  configuredBase &&
  configuredBase.startsWith("/") &&
  !configuredBase.startsWith("//")
    ? configuredBase.replace(/\/$/, "")
    : "";
export const connected = Boolean(apiBase);
async function request(path, body) {
  if (!connected)
    throw new Error(
      "This service is not connected yet. Nothing has been submitted.",
    );
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 404 || response.status === 410
        ? "This invitation or contact is unavailable or expired."
        : "The request could not be completed. Please try again.",
    );
  try {
    return await response.json();
  } catch {
    throw new Error(
      "The service did not confirm the request. Please try again.",
    );
  }
}
export async function validateSchoolCode(code) {
  code = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code))
    throw new Error(
      "Enter a valid invitation code (4–40 letters, numbers, or hyphens).",
    );
  if (!connected) {
    if (code !== "DEMO-BROWARD")
      throw new Error(
        "Code not recognized in this demo. Real school codes need the school backend.",
      );
    return {
      validationToken: "demo-broward",
      schoolId: "demo-school-broward",
      schoolName: "VolunteerU Demo School — Broward",
      isDemo: true,
    };
  }
  const result = await request("/school-invitations/validate", { code });
  if (
    !result.valid ||
    typeof result.validationToken !== "string" ||
    typeof result.schoolId !== "string" ||
    typeof result.schoolName !== "string"
  )
    throw new Error(
      "This invitation is invalid or expired. No school has been connected.",
    );
  return { ...result, isDemo: false };
}
export async function confirmSchool(invitation) {
  if (invitation.isDemo && !connected)
    return {
      schoolId: invitation.schoolId,
      schoolName: invitation.schoolName,
      isDemo: true,
    };
  const result = await request("/school-invitations/confirm", {
    validationToken: invitation.validationToken,
  });
  if (
    !result.connected ||
    result.schoolId !== invitation.schoolId ||
    result.schoolName !== invitation.schoolName
  )
    throw new Error("The service did not confirm your school connection.");
  return {
    schoolId: result.schoolId,
    schoolName: result.schoolName,
    isDemo: false,
  };
}
export async function submitCoordinatorMessage(opportunity, values) {
  if (!opportunity.designatedContact?.id)
    throw new Error(
      "No designated coordinator is connected to this opportunity. Nothing has been sent.",
    );
  // Recipient identity is resolved on the server from this opportunity, never
  // from a student-supplied email or a potential organization directory entry.
  const result = await request(
    `/opportunities/${encodeURIComponent(opportunity.id)}/messages`,
    values,
  );
  if (
    result.submitted !== true ||
    typeof result.messageId !== "string" ||
    !result.messageId.trim()
  )
    throw new Error(
      "The service did not confirm submission. Your message has not been marked as sent.",
    );
  return result;
}

// Optional authenticated event snapshot. It contains only the current student's
// records; the backend must never trust a caller-supplied student ID.
export async function fetchStudentUpdates() {
  if (!connected) return null;
  const response = await fetch(`${apiBase}/student/updates`, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Student updates could not be refreshed.");
  const payload = await response.json();
  if (
    typeof payload.studentId !== "string" ||
    !Array.isArray(payload.applications) ||
    !Array.isArray(payload.hours) ||
    !Array.isArray(payload.shifts)
  )
    throw new Error("The student update response is incomplete.");
  return payload;
}
