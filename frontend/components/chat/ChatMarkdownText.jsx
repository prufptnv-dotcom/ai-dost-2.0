import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { renderMarkdown } from '../../utils/markdownUtils';

export function ChatMarkdownText({ text }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return (
    <div
      className="md-prose text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

ChatMarkdownText.propTypes = {
  text: PropTypes.string.isRequired,
};
