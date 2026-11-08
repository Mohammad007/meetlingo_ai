import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

/** Locally drawn stroke icons (24x24 grid). No icon font or network assets. */
export type IconName =
  | 'mic' | 'mic-off' | 'pause' | 'play' | 'stop' | 'expand' | 'shrink' | 'settings' | 'history' | 'book' | 'home'
  | 'laptop' | 'phone' | 'users' | 'check' | 'check-circle' | 'x' | 'alert' | 'wifi' | 'wifi-off' | 'download'
  | 'trash' | 'edit' | 'copy' | 'search' | 'share' | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'plus'
  | 'minus' | 'translate' | 'file' | 'refresh' | 'shield' | 'info' | 'layers' | 'sliders' | 'cpu' | 'list'
  | 'save' | 'speaker' | 'headphones' | 'bell' | 'database' | 'moon' | 'sun' | 'activity' | 'clock' | 'more'
  | 'external' | 'filter' | 'sparkle' | 'checkbox' | 'checkbox-on' | 'calendar' | 'user';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = '#102846', strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {render(name, p, color)}
    </Svg>
  );
}

function render(name: IconName, p: Record<string, unknown>, color: string) {
  switch (name) {
    case 'mic':
      return (<><Rect x={9} y={3} width={6} height={11} rx={3} {...p} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" {...p} /></>);
    case 'mic-off':
      return (<><Path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5.1 2.1M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.8 5.9M12 18v3M8 21h8M3 3l18 18" {...p} /></>);
    case 'pause':
      return (<><Rect x={6} y={5} width={4} height={14} rx={1} fill={color} stroke="none" /><Rect x={14} y={5} width={4} height={14} rx={1} fill={color} stroke="none" /></>);
    case 'play':
      return <Path d="M7 4.5v15l12.5-7.5z" fill={color} stroke="none" />;
    case 'stop':
      return <Rect x={6} y={6} width={12} height={12} rx={2} fill={color} stroke="none" />;
    case 'expand':
      return <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" {...p} />;
    case 'shrink':
      return <Path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" {...p} />;
    case 'settings':
      return (<><Circle cx={12} cy={12} r={3} {...p} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...p} /></>);
    case 'history':
      return (<><Path d="M3 12a9 9 0 1 0 3-6.7L3 8" {...p} /><Path d="M3 3v5h5M12 7v5l3 2" {...p} /></>);
    case 'book':
      return <Path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" {...p} />;
    case 'home':
      return <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...p} />;
    case 'laptop':
      return (<><Rect x={4} y={4} width={16} height={11} rx={1.5} {...p} /><Path d="M2 19h20" {...p} /></>);
    case 'phone':
      return (<><Rect x={6} y={2} width={12} height={20} rx={2.5} {...p} /><Path d="M11 18h2" {...p} /></>);
    case 'users':
      return (<><Circle cx={9} cy={8} r={3.5} {...p} /><Path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" {...p} /></>);
    case 'user':
      return (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21a8 8 0 0 1 16 0" {...p} /></>);
    case 'check':
      return <Polyline points="4 12.5 9.5 18 20 6" {...p} />;
    case 'check-circle':
      return (<><Circle cx={12} cy={12} r={9.5} {...p} /><Polyline points="7.5 12.5 10.5 15.5 16.5 9" {...p} /></>);
    case 'x':
      return <Path d="M6 6l12 12M18 6 6 18" {...p} />;
    case 'alert':
      return (<><Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" {...p} /><Path d="M12 9v4M12 17h.01" {...p} /></>);
    case 'wifi':
      return <Path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01" {...p} />;
    case 'wifi-off':
      return <Path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5.2-2.7M2 8.8a15 15 0 0 1 4.2-2.7M16.7 10.7A10 10 0 0 1 19 12.6M10.7 5.1A15 15 0 0 1 22 8.8M12 20h.01" {...p} />;
    case 'download':
      return <Path d="M12 3v12M7 10l5 5 5-5M4 20h16" {...p} />;
    case 'trash':
      return <Path d="M3 6h18M8 6V4h8v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14M10 11v6M14 11v6" {...p} />;
    case 'edit':
      return <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" {...p} />;
    case 'copy':
      return (<><Rect x={9} y={9} width={12} height={12} rx={2} {...p} /><Path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" {...p} /></>);
    case 'search':
      return (<><Circle cx={11} cy={11} r={7} {...p} /><Path d="M21 21l-4.5-4.5" {...p} /></>);
    case 'share':
      return (<><Circle cx={18} cy={5} r={3} {...p} /><Circle cx={6} cy={12} r={3} {...p} /><Circle cx={18} cy={19} r={3} {...p} /><Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" {...p} /></>);
    case 'chevron-right':
      return <Polyline points="9 5 16 12 9 19" {...p} />;
    case 'chevron-left':
      return <Polyline points="15 5 8 12 15 19" {...p} />;
    case 'chevron-down':
      return <Polyline points="5 9 12 16 19 9" {...p} />;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'minus':
      return <Path d="M5 12h14" {...p} />;
    case 'translate':
      return <Path d="M4 5h9M8.5 3v2M11 5c-1 4-4 7-7 8.5M6.5 9c1 2 3 3.5 5 4.5M13 21l4-9 4 9M14.5 18h5" {...p} />;
    case 'file':
      return (<><Path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" {...p} /><Path d="M14 3v5h5M9 13h6M9 17h6" {...p} /></>);
    case 'refresh':
      return <Path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12A9 9 0 0 1 18.5 5.8L21 8M21 3v5h-5M3 21v-5h5" {...p} />;
    case 'shield':
      return <Path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z" {...p} />;
    case 'info':
      return (<><Circle cx={12} cy={12} r={9.5} {...p} /><Path d="M12 11v6M12 7.5h.01" {...p} /></>);
    case 'layers':
      return <Path d="M12 2.5 2.5 7.5 12 12.5l9.5-5zM2.5 12 12 17l9.5-5M2.5 16.5 12 21.5l9.5-5" {...p} />;
    case 'sliders':
      return <Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" {...p} />;
    case 'cpu':
      return (<><Rect x={5} y={5} width={14} height={14} rx={2} {...p} /><Rect x={9} y={9} width={6} height={6} {...p} /><Path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" {...p} /></>);
    case 'list':
      return <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" {...p} />;
    case 'save':
      return (<><Path d="M5 3h11l5 5v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" {...p} /><Path d="M7 3v6h8V3M7 21v-7h10v7" {...p} /></>);
    case 'speaker':
      return (<><Path d="M11 5 6 9H2v6h4l5 4z" {...p} /><Path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" {...p} /></>);
    case 'headphones':
      return <Path d="M3 18v-6a9 9 0 0 1 18 0v6M3 14h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM21 14h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" {...p} />;
    case 'bell':
      return <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 21a2 2 0 0 0 3.4 0" {...p} />;
    case 'database':
      return (<><Path d="M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z" {...p} /><Path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" {...p} /></>);
    case 'moon':
      return <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" {...p} />;
    case 'sun':
      return (<><Circle cx={12} cy={12} r={4.5} {...p} /><Path d="M12 1.5v2M12 20.5v2M4.6 4.6 6 6M18 18l1.4 1.4M1.5 12h2M20.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" {...p} /></>);
    case 'activity':
      return <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" {...p} />;
    case 'clock':
      return (<><Circle cx={12} cy={12} r={9.5} {...p} /><Path d="M12 7v5l3 2" {...p} /></>);
    case 'more':
      return (<><Circle cx={12} cy={5} r={1.6} fill={color} stroke="none" /><Circle cx={12} cy={12} r={1.6} fill={color} stroke="none" /><Circle cx={12} cy={19} r={1.6} fill={color} stroke="none" /></>);
    case 'external':
      return <Path d="M14 3h7v7M10 14 21 3M19 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" {...p} />;
    case 'filter':
      return <Path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" {...p} />;
    case 'sparkle':
      return <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" {...p} />;
    case 'checkbox':
      return <Rect x={3.5} y={3.5} width={17} height={17} rx={3} {...p} />;
    case 'checkbox-on':
      return (<><Rect x={3.5} y={3.5} width={17} height={17} rx={3} fill={color} stroke={color} strokeWidth={2} /><Polyline points="7.5 12.5 10.5 15.5 16.5 9" stroke="#FFFFFF" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>);
    case 'calendar':
      return (<><Rect x={3.5} y={5} width={17} height={16} rx={2} {...p} /><Path d="M3.5 10h17M8 3v4M16 3v4" {...p} /></>);
    default:
      return <Line x1={4} y1={12} x2={20} y2={12} {...p} />;
  }
}
