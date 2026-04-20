type LikeButtonProps = {
  liked: boolean;
  count?: number;
  onClick: () => void;
  size?: number;
};

function LikeButton({
  liked,
  count = 0,
  onClick,
  size = 18,
}: LikeButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid #444',
        background: '#1a1a1a',
        color: liked ? '#ef4444' : '#9ca3af',
        cursor: 'pointer',
        fontSize: '0.95rem',
      }}
      aria-label={liked ? 'unlike' : 'like'}
    >
      <span
        style={{
          fontSize: size,
          lineHeight: 1,
          color: liked ? '#ef4444' : '#9ca3af',
        }}
      >
        {liked ? '♥' : '♡'}
      </span>
      <span style={{ color: liked ? '#ef4444' : '#9ca3af' }}>{count}</span>
    </button>
  );
}

export default LikeButton;