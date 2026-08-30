<?php
/**
 * Plugin Name: オリにゃんチャット
 * Description: 公式サイトの右下にオリにゃんを出します。テーマファイルは変更しません。停止すれば元どおりになります。
 * Version: 1.0.0
 * Author: オリエントホールディングス
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
  exit;
}

const ORIENT_ORINYAN_CHAT_VERSION = '1.0.0';
const ORIENT_ORINYAN_CHAT_API = 'https://orient-chat-api.uken-shohei.workers.dev';

add_action('wp_enqueue_scripts', 'orient_orinyan_chat_enqueue');
add_action('wp_footer', 'orient_orinyan_chat_render', 99);

function orient_orinyan_chat_enqueue() {
  if (is_admin()) {
    return;
  }

  wp_enqueue_script(
    'cloudflare-turnstile',
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    [],
    null,
    true
  );
  wp_enqueue_script(
    'orient-orinyan-chat',
    ORIENT_ORINYAN_CHAT_API . '/widget/orient-chat.js',
    ['cloudflare-turnstile'],
    ORIENT_ORINYAN_CHAT_VERSION,
    true
  );
}

function orient_orinyan_chat_render() {
  if (is_admin()) {
    return;
  }

  $api = esc_url(ORIENT_ORINYAN_CHAT_API);
  ?>
  <style id="orient-orinyan-chat-dock">
    @media (max-width: 736px) {
      orient-chat:not([style*="--orient-offset-bottom"]) {
        bottom: 68px !important;
        left: 10px !important;
        right: 10px !important;
      }
    }
  </style>
  <orient-chat
    api-url="<?php echo $api; ?>"
    primary-color="#ff680b"
    ink-color="#29293a"
    character-src="<?php echo $api; ?>/assets/orinyan-states.png"
    turnstile-site-key="0x4AAAAAAELFZjpF4XsO2kRC"
    line-url="https://page.line.me/089wmudt"
    contact-url="https://orijyu.com/reception.html"
    avoid-selector="#click_to_call_bar, .ctc_bar"
  ></orient-chat>
  <?php
}
