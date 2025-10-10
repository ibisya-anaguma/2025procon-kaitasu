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
