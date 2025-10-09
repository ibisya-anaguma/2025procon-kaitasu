"use client";

import { Button } from "@/components/ui/button";
import {
  SidebarCatalogIcon,
  SidebarCartIcon,
  SidebarHistoryIcon,
  SidebarHomeIcon,
  SidebarProfileIcon,
  SidebarSubscriptionIcon
} from "@/components/icons/sidebar-icons";
import type { Screen, SidebarIconComponent, SidebarNavKey } from "@/types/page";

const SIDEBAR_ACTIVE_BG =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22192%22%20height=%22100%22%20viewBox=%220%200%20192%20100%22%20fill=%22none%22%3E%3Cpath%20d=%22M0%2040.0005C0%2028.9548%208.9543%2020.0005%2020%2020.0005H192V79.2693H20C8.95431%2079.2693%200%2070.315%200%2059.2693V40.0005Z%22%20fill=%22white%22/%3E%3Cpath%20d=%22M192%2079.2695H172C183.046%2079.2697%20192%2088.224%20192%2099.2695V79.2695Z%22%20fill=%22white%22/%3E%3Cpath%20d=%22M192%2020H172C183.046%2019.9998%20192%2011.0456%20192%200V20Z%22%20fill=%22white%22/%3E%3C/svg%3E\")";

const SIDEBAR_LABEL_BASE_STYLE = {
  display: "flex",
  width: "118px",
  height: "52.616px",
  justifyContent: "center",
  alignItems: "center",
  gap: "4.5px",
  color: "#ffffff",
  textAlign: "center" as const,
  fontFamily: '"BIZ UDPGothic"',
  fontSize: "20px",
  fontStyle: "normal" as const,
  fontWeight: 700,
  lineHeight: "100%",
  letterSpacing: "1.04px"
};

const SIDEBAR_LABEL_SELECTED_STYLE = {
  color: "#101010",
  textAlign: "center" as const,
  fontFamily: '"BIZ UDPGothic"',
  fontSize: "20px",
  fontStyle: "normal" as const,
  fontWeight: 700,
  lineHeight: "100%",
  letterSpacing: "1.04px"
};

const SIDEBAR_ICON_STYLE = {
  display: "flex",
  width: "31.5px",
  height: "34.616px",
  flexShrink: 0,
  justifyContent: "center",
  alignItems: "center"
};

type SidebarProps = {
  currentScreen: Screen;
  hoveredNav: SidebarNavKey | null;
  onHoverChange: (key: SidebarNavKey | null) => void;
  onNavigate: (screen: Screen) => void;
};

export function Sidebar({ currentScreen, hoveredNav, onHoverChange, onNavigate }: SidebarProps) {
  const renderSidebarButton = (
    key: SidebarNavKey,
    label: string,
    Icon: SidebarIconComponent,
    dataOid: string,
    onClick?: () => void
  ) => {
    const isSubscriptionKey = key === "subscription";
    const isCatalogKey = key === "catalog";
    const isActive = isSubscriptionKey
      ? currentScreen === "subscription" || currentScreen === "subscriptionAdd"
      : isCatalogKey
        ? currentScreen === "catalog" || currentScreen === "catalogLanding"
        : currentScreen === key;
    const isHovered = hoveredNav === key;
    const showHighlight = isActive || isHovered;
    const highlightOpacity = isActive ? 1 : isHovered ? 0.4 : 0;
    const iconFill = isActive ? "#209fde" : "#ffffff";
    const iconStroke = isActive ? "#209fde" : "#ffffff";

    return (
      <Button
        key={key}
        variant="ghost"
        size="sm"
        className="w-full flex justify-end px-0 py-0 bg-transparent hover:bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        style={{ height: "99.27px" }}
        onMouseEnter={() => onHoverChange(key)}
        onMouseLeave={() => onHoverChange(null)}
        onClick={onClick}
        data-oid={dataOid}>
        <span
          className="flex items-center justify-end"
          style={{
            width: "100%",
            height: "99.27px",
            flexShrink: 0
          }}>
          <span
            className="flex items-center relative"
            style={{
              width: "192px",
              height: "99.27px",
              flexShrink: 0,
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 100%",
              backgroundPosition: "right center",
              justifyContent: "flex-start",
              paddingLeft: "20px",
              gap: "12px",
              transform: "translateX(1px)"
            }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: showHighlight ? SIDEBAR_ACTIVE_BG : "none",
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                opacity: highlightOpacity,
                pointerEvents: "none",
                zIndex: 0
              }}>
            </span>
            <span style={{ ...SIDEBAR_ICON_STYLE, position: "relative", zIndex: 1 }}>
              <Icon fill={iconFill} stroke={iconStroke} />
            </span>
            <span
              className="text-xs font-medium"
              style={{
                ...SIDEBAR_LABEL_BASE_STYLE,
                ...(isActive ? SIDEBAR_LABEL_SELECTED_STYLE : {}),
                color: isActive ? "#101010" : "#ffffff",
                position: "relative",
                zIndex: 1
              }}>
              {label}
            </span>
          </span>
        </span>
      </Button>
    );
  };

  return (
    <div
      className="w-[232px] bg-[#fda900] flex flex-col items-center py-6 space-y-8 fixed left-0 top-0 h-full z-10 rounded-tr-[20px] rounded-br-[20px]"
      data-oid="ehf5pv5">
      <div className="flex flex-col items-center" data-oid="pm140hy">
        <img
          src="/images/logo_kaitasu.png"
          alt="かいたす"
          className="h-[72px] w-[72px]"
          data-oid="kaitasu-logo"
        />
      </div>

      <nav className="w-full flex flex-col items-end space-y-2 pr-0" data-oid="bglg0.p">
        {renderSidebarButton("dashboard", "ホーム", SidebarHomeIcon, "lqzeqpl", () => onNavigate("dashboard"))}
        {renderSidebarButton("catalog", "買い出し", SidebarCatalogIcon, "iu4097_", () => onNavigate("catalogLanding"))}
        {renderSidebarButton("cart", "買い物かご", SidebarCartIcon, "1yqj0f6", () => onNavigate("cart"))}
        {renderSidebarButton("history", "購入履歴", SidebarHistoryIcon, "rzbvl29", () => onNavigate("history"))}
        {renderSidebarButton(
          "subscription",
          "定期購入",
          SidebarSubscriptionIcon,
          "sub-btn-1",
          () => onNavigate("subscription")
        )}
        {renderSidebarButton("profile", "マイページ", SidebarProfileIcon, "jyqaqbq", () => onNavigate("profile"))}
      </nav>
    </div>
  );
}


