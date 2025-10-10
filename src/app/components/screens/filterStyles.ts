// Tailwind CSS classes for filter buttons
export const FILTER_BUTTON_INACTIVE_CLASS = "flex items-center justify-center w-max min-w-[160px] h-[60px] px-6 shrink-0 rounded-[20px] border-2 border-[#FDA900] bg-white shadow-[4.5px_4.5px_0_0_#E4E2E2]";

export const FILTER_BUTTON_TEXT_CLASS = "text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px]";

// Legacy exports for backward compatibility (deprecated)
export const FILTER_BUTTON_INACTIVE_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "max-content",
  minWidth: "160px",
  height: "60px",
  padding: "0 24px",
  flexShrink: 0,
  borderRadius: "20px",
  border: "2px solid #FDA900",
  background: "var(--, #FFF)",
  boxShadow: "4.5px 4.5px 0 0 #E4E2E2"
} as const;

export const FILTER_BUTTON_TEXT_STYLE = {
  color: "var(--, #101010)",
  fontFamily: '"BIZ UDPGothic"',
  fontSize: "32px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "normal",
  letterSpacing: "1.664px"
} as const;
