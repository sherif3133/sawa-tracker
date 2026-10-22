<?php
/**
 * Links students attach to their study logs: the YouTube video, song, podcast or article they worked on.
 * Search by title (YouTube), or paste a link. Without an API key the search reads YouTube's public results
 * page; with the optional YouTube Data API key (Settings) it uses the official API. Results are cached a day.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Media {

	const MAX_LINKS = 5;

	/** Up to 8 YouTube videos for a title: [{url, title, channel, thumb, duration, vid}]. */
	public static function search( $uid, $q ) {
		$q = mb_substr( trim( sanitize_text_field( (string) $q ) ), 0, 120 );
		if ( mb_strlen( $q ) < 2 ) {
			return array();
		}
		$key = 'sawa_tr_yt_' . md5( strtolower( $q ) );
		$hit = get_transient( $key );
		if ( is_array( $hit ) ) {
			return $hit;
		}
		// 40 new searches an hour per student (cached ones are free).
		$rk = 'sawa_tr_ytn_' . $uid . '_' . gmdate( 'YmdH' );
		$n  = (int) get_transient( $rk );
		if ( $n >= 40 ) {
			return new WP_Error( 'limit', 'Too many searches. Paste the link instead, or try again in a bit.', array( 'status' => 429 ) );
		}
		set_transient( $rk, $n + 1, HOUR_IN_SECONDS );
		$api = (string) ( Sawa_Tracker_Game::settings()['yt_key'] ?? '' );
		$out = '' !== $api ? self::search_api( $q, $api ) : null;
		if ( ! $out ) {
			$out = self::search_page( $q );
		}
		set_transient( $key, $out, $out ? DAY_IN_SECONDS : 10 * MINUTE_IN_SECONDS );
		return $out;
	}

	private static function item( $vid, $title, $channel, $duration = '' ) {
		return array(
			'vid'      => $vid,
			'url'      => 'https://www.youtube.com/watch?v=' . $vid,
			'title'    => mb_substr( wp_strip_all_tags( html_entity_decode( (string) $title, ENT_QUOTES ) ), 0, 150 ),
			'channel'  => mb_substr( wp_strip_all_tags( html_entity_decode( (string) $channel, ENT_QUOTES ) ), 0, 80 ),
			'duration' => mb_substr( (string) $duration, 0, 10 ),
			'thumb'    => 'https://i.ytimg.com/vi/' . $vid . '/mqdefault.jpg',
		);
	}

	private static function search_api( $q, $key ) {
		$res = wp_remote_get( add_query_arg( array( 'part' => 'snippet', 'type' => 'video', 'maxResults' => 8, 'safeSearch' => 'moderate', 'q' => $q, 'key' => $key ), 'https://www.googleapis.com/youtube/v3/search' ), array( 'timeout' => 6 ) );
		$j   = is_wp_error( $res ) ? null : json_decode( wp_remote_retrieve_body( $res ), true );
		$out = array();
		foreach ( (array) ( $j['items'] ?? array() ) as $it ) {
			$vid = (string) ( $it['id']['videoId'] ?? '' );
			if ( preg_match( '/^[\w-]{11}$/', $vid ) ) {
				$out[] = self::item( $vid, $it['snippet']['title'] ?? '', $it['snippet']['channelTitle'] ?? '' );
			}
		}
		return $out;
	}

	/** No key: the public results page holds the results as JSON (ytInitialData). */
	private static function search_page( $q ) {
		$res = wp_remote_get(
			add_query_arg( array( 'search_query' => $q, 'hl' => 'en', 'gl' => 'US' ), 'https://www.youtube.com/results' ),
			array(
				'timeout' => 8,
				'headers' => array(
					'User-Agent'      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
					'Accept-Language' => 'en-US,en;q=0.9',
					'Cookie'          => 'SOCS=CAI', // skip the cookie-consent page some regions get
				),
			)
		);
		if ( is_wp_error( $res ) || ! preg_match( '/var ytInitialData = (\{.*?\});<\/script>/s', wp_remote_retrieve_body( $res ), $m ) ) {
			return array();
		}
		$d   = json_decode( $m[1], true );
		$out = array();
		$walk = function ( $o ) use ( &$walk, &$out ) {
			if ( ! is_array( $o ) || count( $out ) >= 8 ) {
				return;
			}
			if ( isset( $o['videoRenderer']['videoId'] ) ) {
				$v = $o['videoRenderer'];
				if ( preg_match( '/^[\w-]{11}$/', $v['videoId'] ) ) {
					$out[] = self::item( $v['videoId'], $v['title']['runs'][0]['text'] ?? '', $v['ownerText']['runs'][0]['text'] ?? '', $v['lengthText']['simpleText'] ?? '' );
				}
				return;
			}
			foreach ( $o as $x ) {
				$walk( $x );
			}
		};
		$walk( $d );
		return $out;
	}

	/** A pasted link: its title (YouTube via oEmbed; other sites show their address). */
	public static function info( $url ) {
		$url = esc_url_raw( trim( (string) $url ), array( 'http', 'https' ) );
		if ( '' === $url ) {
			return new WP_Error( 'url', 'That doesn\'t look like a link.', array( 'status' => 400 ) );
		}
		if ( preg_match( '~(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|live/)|youtu\.be/)([\w-]{11})~', $url, $m ) ) {
			$key = 'sawa_tr_yto_' . $m[1];
			$hit = get_transient( $key );
			if ( is_array( $hit ) ) {
				return $hit;
			}
			$res = wp_remote_get( add_query_arg( array( 'url' => 'https://www.youtube.com/watch?v=' . $m[1], 'format' => 'json' ), 'https://www.youtube.com/oembed' ), array( 'timeout' => 6 ) );
			$j   = is_wp_error( $res ) ? null : json_decode( wp_remote_retrieve_body( $res ), true );
			$it  = self::item( $m[1], $j['title'] ?? 'YouTube video', $j['author_name'] ?? '' );
			set_transient( $key, $it, WEEK_IN_SECONDS );
			return $it;
		}
		$host = (string) wp_parse_url( $url, PHP_URL_HOST );
		return array( 'vid' => '', 'url' => $url, 'title' => preg_replace( '/^www\./', '', $host ), 'channel' => '', 'duration' => '', 'thumb' => '' );
	}

	/** The links saved with a log: at most 5, http(s) only, short titles. */
	public static function clean( $links ) {
		$out = array();
		foreach ( array_slice( (array) $links, 0, self::MAX_LINKS ) as $l ) {
			if ( ! is_array( $l ) ) {
				continue;
			}
			$url = esc_url_raw( (string) ( $l['url'] ?? '' ), array( 'http', 'https' ) );
			if ( '' === $url ) {
				continue;
			}
			$vid   = preg_match( '/^[\w-]{11}$/', (string) ( $l['vid'] ?? '' ) ) ? $l['vid'] : '';
			$out[] = array(
				'url'     => mb_substr( $url, 0, 500 ),
				'title'   => mb_substr( sanitize_text_field( (string) ( $l['title'] ?? '' ) ), 0, 150 ),
				'channel' => mb_substr( sanitize_text_field( (string) ( $l['channel'] ?? '' ) ), 0, 80 ),
				'vid'     => $vid,
			);
		}
		return $out;
	}
}
