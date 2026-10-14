// Disabled until a deployed collector is configured. No cookies or persistent visitor IDs.
const endpoint = ""; // Example: https://bot-watch.YOUR-SUBDOMAIN.workers.dev/collect
if (endpoint) {
 const session = crypto.randomUUID();
 const params = new URLSearchParams(location.search);
 const source = params.has("frame_id") ? "discord" : "web";
 const send = () => {
  if (document.visibilityState !== "visible") return;
  fetch(endpoint, {
   method:"POST", mode:"cors", credentials:"omit",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({app:"wct",source,sid:session}),keepalive:true
  }).catch(()=>{});
 };
 send();
 setInterval(send,60000);
 document.addEventListener("visibilitychange",send);
}
// Include only after publishing the privacy notice:
// <script type="module" src="./usage.js"></script>
