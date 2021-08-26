// <nowiki>
// @ts-check
// Extended info on IPs - gives a popup with their range, ASN, and ISP
// Parts cribbed from [[User:Krinkle/Scripts/CVNSimpleOverlay_wiki.js]] and [[MediaWiki:Gadget-markblocked.js]]

/* global mw, $  */

const ipExtIcon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Gnome-fs-web.svg/20px-Gnome-fs-web.svg.png'

/**
 * Get all userlinks on the page
 *
 * @param {JQuery} $content page contents
 * @return {Map} list of unique users on the page and their corresponding links
 */
function ipExtGetIPs ($content) {
  const userLinks = new Map()

  // Get all aliases for user: (taken from markblocked)
  const userNS = []
  for (const ns in mw.config.get('wgNamespaceIds')) {
    if (mw.config.get('wgNamespaceIds')[ns] === 2) {
      userNS.push(mw.util.escapeRegExp(ns.replace(/_/g, ' ')) + ':')
    }
  }

  // RegExp for all titles that are User:
  const userTitleRX = new RegExp('^(' + userNS.join('|') + 'Special:Block/|Special:Contribs/|Special:Contributions/)+([^\\/#]+)$', 'i')
  const articleRX = new RegExp(mw.config.get('wgArticlePath').replace('$1', '') + '([^#]+)')
  $('a', $content).each(function () {
    if (!$(this).attr('href')) {
      // Ignore if the <a> doesn't have a href
      return
    }
    const articleTitleReMatch = articleRX.exec($(this).attr('href').toString())
    if (!articleTitleReMatch) {
      return
    }
    const pgTitle = decodeURIComponent(articleTitleReMatch[1]).replace(/_/g, ' ')
    const userTitleReMatch = userTitleRX.exec(pgTitle)
    if (!userTitleReMatch) {
      return
    }
    const username = userTitleReMatch[2]
    if (mw.util.isIPAddress(username, true)) {
      if (!userLinks.get(username)) {
        userLinks.set(username, [])
      }
      userLinks.get(username).push($(this))
    }
  })
  return userLinks
}

/**
 * Get the WHOIS summary for an IP
 *
 * @param {string} ip IP address to check
 *
 * @return {Promise<string>} Summary of interesting parts of the IP's WHOIS
 */
async function ipExtWHOISInline (ip) {
  const whoisResult = await fetch(`https://whois.toolforge.org/w/${ip}/lookup/json`)
  const whoisJson = await whoisResult.json() // Why is json() async?
  let providers = ''
  whoisJson.nets.forEach((net) => {
    providers += net.name + ' '
  })
  return `${ip}:\n  ASN: ${whoisJson.asn}\n  ASN range: ${whoisJson.asn_cidr}\n  ASN country: ${whoisJson.asn_country_code}\n  ISP: ${providers}`
}

// On window load, get all the IPs on the page and WHOIS them asynchronously
$.when($.ready, mw.loader.using(['mediawiki.util', 'jquery.makeCollapsible'])).then(function () {
  mw.hook('wikipage.content').add(function ($content) {
    const ipsOnPage = ipExtGetIPs($content)
    ipsOnPage.forEach(async (val, ip, _) => {
      const whoisText = await ipExtWHOISInline(ip)
      val.forEach(($link) => {
        $link.after($('<a>').attr('href', `https://bullseye.toolforge.org/ip/${ip}`).attr('target', 'blank').attr('rel', 'noopener noreferrer')
          .append($('<img>').attr('src', ipExtIcon).attr('title', mw.html.escape(whoisText))))
      })
    })
  })
})
